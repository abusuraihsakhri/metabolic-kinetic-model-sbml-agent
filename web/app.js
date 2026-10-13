/* Browser-only structural inspection and threshold evaluation. No network requests. */
const KEYWORDS = ["DISCORDANT", "ANOMALY", "MUTANT", "VIOLATION", "FAIL", "REJECT"];

export function evaluateMetric(payload) {
  const taskId = String(payload.task_id ?? "").trim();
  const target = String(payload.target_identifier ?? "").trim();
  const primary = Number(payload.primary_metric);
  const secondary = Number(payload.secondary_metric);
  const descriptor = String(payload.status_descriptor ?? "").trim();
  if (!taskId || !target || taskId.length > 120 || target.length > 120) {
    throw new Error("Task ID and target identifier are required (maximum 120 characters).");
  }
  if (payload.primary_metric === "" || payload.secondary_metric === "" ||
      !Number.isFinite(primary) || !Number.isFinite(secondary)) {
    throw new Error("Both metrics must be finite numeric values.");
  }
  if (descriptor.length > 200) throw new Error("Descriptor is too long.");
  if (typeof payload.is_critical_flag !== "boolean") throw new Error("Critical flag must be true or false.");
  const alerts = [];
  if (primary > 25) {
    alerts.push({worker:"InvariantQCWorker",urgency:"ELEVATED_RISK",summary:"Primary metric exceeds the project threshold of 25."});
  }
  if (payload.is_critical_flag || secondary > 12) {
    alerts.push({worker:"SafetyEscalationWorker",urgency:payload.is_critical_flag ? "CRITICAL_STAT_PANIC" : "ELEVATED_RISK",summary:"Secondary metric > 12 or critical flag set."});
  }
  if (KEYWORDS.some(word => descriptor.toUpperCase().includes(word))) {
    alerts.push({worker:"ProtocolConformanceWorker",urgency:"ELEVATED_RISK",summary:"Descriptor matches a project-defined anomaly keyword."});
  }
  const urgency = alerts.some(a => a.urgency === "CRITICAL_STAT_PANIC") ? "CRITICAL_STAT_PANIC" :
    alerts.length ? "ELEVATED_RISK" : "ROUTINE";
  return {
    task_id: taskId, target_identifier: target,
    primary_metric: primary, secondary_metric: secondary,
    status_descriptor: descriptor, is_critical_flag: payload.is_critical_flag,
    overall_urgency: urgency,
    integrity_status: urgency === "CRITICAL_STAT_PANIC" ? "RECALIBRATION_REQUIRED" :
      urgency === "ELEVATED_RISK" ? "DISCORDANT_ANOMALY" : "VALIDATED_OPTIMAL",
    total_alerts: alerts.length,
    critical_alerts_count: alerts.filter(a => a.urgency === "CRITICAL_STAT_PANIC").length,
    alerts, method: "Browser-local heuristic threshold evaluation",
    signed: false
  };
}

const byId = id => document.getElementById(id);
const child = (parent, local) => Array.from(parent?.children || []).find(x => x.localName === local);
const items = (parent, list, local) => Array.from(child(parent,list)?.children || []).filter(x => x.localName === local);
const attribute = (node, name) => node.getAttribute(name) || "";
const clipped = (s,n=1200) => s.length > n ? s.slice(0,n) + "…" : s;

export function inspectSbml(xmlText) {
  if (typeof DOMParser === "undefined") throw new Error("SBML XML parsing requires a browser.");
  if (typeof xmlText !== "string" || !xmlText.trim() || xmlText.length > 2_000_000) {
    throw new Error("Provide a nonempty SBML file smaller than 2 MB.");
  }
  if (/<!\s*(DOCTYPE|ENTITY)\b/i.test(xmlText)) throw new Error("XML DTD and entity declarations are unsupported.");
  const doc = new DOMParser().parseFromString(xmlText,"application/xml");
  if (doc.querySelector("parsererror") || doc.documentElement.localName !== "sbml") {
    throw new Error("The file is not well-formed SBML XML.");
  }
  const root=doc.documentElement, model=child(root,"model");
  if (!model) throw new Error("SBML document contains no model.");
  const species=items(model,"listOfSpecies","species").map(s=>({
    id:attribute(s,"id"), name:attribute(s,"name"),
    compartment:attribute(s,"compartment"),
    initialAmount:attribute(s,"initialAmount"),
    initialConcentration:attribute(s,"initialConcentration")
  }));
  const compartments=items(model,"listOfCompartments","compartment").map(s=>({
    id:attribute(s,"id"), size:attribute(s,"size")
  }));
  const parameters=items(model,"listOfParameters","parameter").map(p=>({
    id:attribute(p,"id"), value:attribute(p,"value"), units:attribute(p,"units")
  }));
  const reactions=items(model,"listOfReactions","reaction").map(r=>{
    const kinetic=child(r,"kineticLaw");
    const math=child(kinetic,"math");
    return {
      id:attribute(r,"id"), reversible:attribute(r,"reversible"),
      reactants:items(r,"listOfReactants","speciesReference").map(s=>({species:attribute(s,"species"),stoichiometry:attribute(s,"stoichiometry") || "1"})),
      products:items(r,"listOfProducts","speciesReference").map(s=>({species:attribute(s,"species"),stoichiometry:attribute(s,"stoichiometry") || "1"})),
      kineticLawFormula:kinetic ? attribute(kinetic,"formula") : "",
      mathML:math ? clipped(new XMLSerializer().serializeToString(math)) : "",
      localParameters:kinetic ? [
        ...items(kinetic,"listOfLocalParameters","localParameter"),
        ...items(kinetic,"listOfParameters","parameter")
      ].map(p=>({id:attribute(p,"id"),value:attribute(p,"value")})) : []
    };
  });
  const warnings=[];
  if (!root.getAttribute("xmlns") && !root.namespaceURI) warnings.push("No SBML namespace was found.");
  if (!reactions.length) warnings.push("No reactions were found.");
  if (items(model,"listOfRules","assignmentRule").length || items(model,"listOfRules","rateRule").length)
    warnings.push("Model contains rules; they are not evaluated.");
  return {
    model_id:attribute(model,"id"), model_name:attribute(model,"name"),
    sbml_level:attribute(root,"level"), sbml_version:attribute(root,"version"),
    namespace:root.namespaceURI || "",
    counts:{compartments:compartments.length,species:species.length,parameters:parameters.length,reactions:reactions.length},
    compartments,species,parameters,reactions,warnings,
    note:"Structural inventory only. No SBML validation, kinetic simulation, or numerical integration performed."
  };
}

function saveJson(name, data) {
  const blob=new Blob([JSON.stringify(data,null,2)+"\n"],{type:"application/json"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),0);
}

if (typeof document !== "undefined") {
  let lastResult=null, lastModel=null, count=0;
  byId("auditForm").addEventListener("submit",event=>{
    event.preventDefault();
    try {
      const fields={
        task_id:byId("task_id").value, target_identifier:byId("target_id").value,
        primary_metric:byId("primary_metric").value,secondary_metric:byId("secondary_metric").value,
        status_descriptor:byId("status_descriptor").value, is_critical_flag:byId("is_critical").checked
      };
      lastResult=evaluateMetric(fields);
      byId("outputConsole").textContent=JSON.stringify(lastResult,null,2);
      byId("resultStatus").textContent=lastResult.overall_urgency;
      byId("taskCount").textContent=String(++count);
      byId("auditStatus").textContent="Local evaluation complete. Result is unsigned.";
      byId("auditStatus").classList.remove("error");
      byId("downloadResult").disabled=false;
    } catch(error) {
      lastResult=null;
      byId("downloadResult").disabled=true;
      byId("auditStatus").textContent=error.message;
      byId("auditStatus").classList.add("error");
      byId("outputConsole").textContent="Evaluation failed; no result was generated.";
    }
  });
  byId("downloadResult").addEventListener("click",()=>{if(lastResult) saveJson("metric-evaluation.json",lastResult);});
  byId("downloadModel").addEventListener("click",()=>{if(lastModel) saveJson("sbml-summary.json",lastModel);});
  byId("sbml_file").addEventListener("change",async event=>{
    const file=event.target.files?.[0];
    lastModel=null;byId("downloadModel").disabled=true;
    if (!file) {byId("modelStatus").textContent="No model loaded.";return;}
    try {
      if (file.size > 2_000_000) throw new Error("Maximum supported file size is 2 MB.");
      const content=await file.text();
      lastModel=inspectSbml(content);
      byId("modelReport").textContent=JSON.stringify(lastModel,null,2);
      byId("modelStatus").textContent="Model structure parsed locally.";
      byId("modelStatus").classList.remove("error");
      byId("downloadModel").disabled=false;
    } catch(error) {
      byId("modelReport").textContent="No model summary available.";
      byId("modelStatus").textContent=error.message;
      byId("modelStatus").classList.add("error");
    }
  });
}
