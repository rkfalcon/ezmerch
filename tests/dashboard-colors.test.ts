import test from "node:test";
import assert from "node:assert/strict";
import { dashboardColors } from "../lib/product-colors";
test("owners only see globally enabled colors while admins see everything",()=>{
 assert.deepEqual(dashboardColors(['Black','Aqua'],true,true,['Black']),['Black']);
 assert.deepEqual(dashboardColors(['Black','Aqua'],false,true,['Black']),['Black','Aqua']);
});
test("global product disable and explicit empty colors hide all owner choices",()=>{
 assert.deepEqual(dashboardColors(['Black'],true,false,null),[]);
 assert.deepEqual(dashboardColors(['Black'],true,true,[]),[]);
 assert.deepEqual(dashboardColors(['Black'],true,true,null),['Black']);
 assert.deepEqual(dashboardColors(['Black'],false,false,[]),['Black']);
});
