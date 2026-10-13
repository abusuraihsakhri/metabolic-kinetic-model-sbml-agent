import pytest
from sbml_kinetics.inspection import inspect_sbml

SAMPLE = """<sbml xmlns="http://www.sbml.org/sbml/level3/version2/core" level="3" version="2"><model id="decay">
<listOfCompartments><compartment id="cell" size="1"/></listOfCompartments>
<listOfSpecies><species id="S" compartment="cell" initialConcentration="10"/></listOfSpecies>
<listOfParameters><parameter id="k" value="0.2"/></listOfParameters>
<listOfReactions><reaction id="R1"><listOfReactants><speciesReference species="S"/></listOfReactants>
<kineticLaw><math xmlns="http://www.w3.org/1998/Math/MathML"><apply><times/><ci>k</ci><ci>S</ci></apply></math></kineticLaw>
</reaction></listOfReactions></model></sbml>"""


def test_parse_structural_inventory():
    info=inspect_sbml(SAMPLE)
    assert info["model_id"] == "decay"
    assert info["counts"] == {"compartments":1,"species":1,"parameters":1,"reactions":1}
    assert info["reactions"][0]["reactants"] == [{"species":"S","stoichiometry":"1"}]
    assert "times" in info["reactions"][0]["mathML"]


@pytest.mark.parametrize("invalid",["<not-sbml/>","<sbml><model></sbml>",
    '<!DOCTYPE sbml [<!ENTITY x "abc">]><sbml><model/></sbml>',
    "<sbml/>",""])
def test_bad_xml_rejected(invalid):
    with pytest.raises(ValueError):
        inspect_sbml(invalid)


def test_size_limit():
    with pytest.raises(ValueError,match="2 MB"):
        inspect_sbml("<sbml>"+" "*2_000_000+"</sbml>")
