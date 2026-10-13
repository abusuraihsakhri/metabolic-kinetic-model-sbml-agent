"""Bounded structural inspection of SBML XML (not an ODE solver)."""
from pathlib import Path
import re
import xml.etree.ElementTree as ET

MAX_BYTES = 2_000_000


def local(tag):
    return tag.rsplit("}", 1)[-1]


def child(parent, name):
    return next((x for x in (parent if parent is not None else ()) if local(x.tag) == name), None)


def items(parent, collection, name):
    group = child(parent, collection)
    return [x for x in (group if group is not None else ()) if local(x.tag) == name]


def inspect_sbml(source):
    """Inspect species, reactions and declared kinetic laws, rejecting DTDs."""
    if isinstance(source, bytes):
        data = source
    elif isinstance(source, str):
        data = source.encode("utf-8")
    else:
        raise TypeError("SBML source must be XML text or bytes")
    if not data.strip() or len(data) > MAX_BYTES:
        raise ValueError("SBML XML must be nonempty and at most 2 MB")
    if re.search(br"<!\s*(?:DOCTYPE|ENTITY)\b", data, re.IGNORECASE):
        raise ValueError("DTD and entity declarations are not supported")
    try:
        root = ET.fromstring(data)
    except ET.ParseError as exc:
        raise ValueError("Malformed SBML XML") from exc
    if local(root.tag) != "sbml":
        raise ValueError("Root XML element must be sbml")
    model = child(root, "model")
    if model is None:
        raise ValueError("SBML document contains no model")
    def attr(el, name):
        return el.get(name, "") if el is not None else ""
    compartments = [{"id":attr(c,"id"),"size":attr(c,"size")} for c in items(model,"listOfCompartments","compartment")]
    species = [{"id":attr(s,"id"),"name":attr(s,"name"),"compartment":attr(s,"compartment"),
                "initialAmount":attr(s,"initialAmount"),"initialConcentration":attr(s,"initialConcentration")}
               for s in items(model,"listOfSpecies","species")]
    parameters = [{"id":attr(p,"id"),"value":attr(p,"value"),"units":attr(p,"units")}
                  for p in items(model,"listOfParameters","parameter")]
    reactions = []
    for reaction in items(model,"listOfReactions","reaction"):
        kinetic=child(reaction,"kineticLaw")
        math=child(kinetic,"math")
        def references(name):
            return [{"species":attr(s,"species"),"stoichiometry":attr(s,"stoichiometry") or "1"}
                    for s in items(reaction,name,"speciesReference")]
        locals_ = items(kinetic,"listOfLocalParameters","localParameter")
        locals_ += items(kinetic,"listOfParameters","parameter")
        reactions.append({
            "id":attr(reaction,"id"),"reversible":attr(reaction,"reversible"),
            "reactants":references("listOfReactants"),"products":references("listOfProducts"),
            "kineticLawFormula":attr(kinetic,"formula"),
            "mathML":ET.tostring(math,encoding="unicode")[:1200] if math is not None else "",
            "localParameters":[{"id":attr(p,"id"),"value":attr(p,"value")} for p in locals_],
        })
    warnings=[]
    if not root.tag.startswith("{"): warnings.append("No SBML namespace was found.")
    if not reactions: warnings.append("No reactions were found.")
    if items(model,"listOfRules","assignmentRule") or items(model,"listOfRules","rateRule"):
        warnings.append("Model contains rules; they are not evaluated.")
    return {
        "model_id":attr(model,"id"),"model_name":attr(model,"name"),
        "sbml_level":attr(root,"level"),"sbml_version":attr(root,"version"),
        "namespace":root.tag.partition("}")[0].lstrip("{") if root.tag.startswith("{") else "",
        "counts":{"compartments":len(compartments),"species":len(species),
                  "parameters":len(parameters),"reactions":len(reactions)},
        "compartments":compartments,"species":species,"parameters":parameters,
        "reactions":reactions,"warnings":warnings,
        "note":"Structural inventory only. No SBML validation or numerical integration performed.",
    }


def inspect_sbml_file(path):
    path=Path(path)
    if path.stat().st_size > MAX_BYTES:
        raise ValueError("Maximum supported SBML file size is 2 MB")
    return inspect_sbml(path.read_bytes())
