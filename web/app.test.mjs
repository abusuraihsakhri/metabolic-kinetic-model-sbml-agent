import test from "node:test";
import assert from "node:assert/strict";
import {evaluateMetric} from "./app.js";

const input = {task_id:"T1",target_identifier:"S1",primary_metric:10,secondary_metric:4,status_descriptor:"NOMINAL",is_critical_flag:false};
test("nominal metric evaluation",()=>{
  const output=evaluateMetric(input);
  assert.equal(output.overall_urgency,"ROUTINE");
  assert.equal(output.total_alerts,0);
  assert.equal(output.signed,false);
});
test("critical flag and anomaly yield two alerts",()=>{
  const output=evaluateMetric({...input,primary_metric:30,status_descriptor:"DISCORDANT",is_critical_flag:true});
  assert.equal(output.overall_urgency,"CRITICAL_STAT_PANIC");
  assert.equal(output.total_alerts,3);
  assert.equal(output.critical_alerts_count,1);
});
test("threshold boundary and secondary escalation",()=>{
  assert.equal(evaluateMetric({...input,primary_metric:25,secondary_metric:12}).total_alerts,0);
  assert.equal(evaluateMetric({...input,secondary_metric:12.1}).total_alerts,1);
});
test("invalid metrics are not silently coerced",()=>{
  for (const value of ["", "not-a-number", "Infinity", NaN]) {
    assert.throws(()=>evaluateMetric({...input,primary_metric:value}),/finite/);
  }
});
test("whitespace-only task identifiers are rejected",()=>{
  assert.throws(()=>evaluateMetric({...input,task_id:"  "}),/required/);
});
