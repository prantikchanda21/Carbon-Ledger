'use client';
import {useCallback,useEffect,useState} from 'react';
import {DASHBOARD_CONTROLS_STORAGE_KEY,DEFAULT_BUDGET_MILLION,readDashboardBudget,writeDashboardBudget} from './dashboardBudgetSync';
/** Same-tab route navigation and cross-tab dashboard edits both synchronize. */
export function useDashboardBudget(){
 const [budgetMillion,setBudgetMillion]=useState(DEFAULT_BUDGET_MILLION);
 useEffect(()=>{
  const sync=()=>setBudgetMillion(readDashboardBudget());
  const storage=(event:StorageEvent)=>{if(event.key===DASHBOARD_CONTROLS_STORAGE_KEY||event.key===null)sync();};
  const visibility=()=>{if(!document.hidden)sync();};
  sync();window.addEventListener('storage',storage);window.addEventListener('focus',sync);document.addEventListener('visibilitychange',visibility);
  return()=>{window.removeEventListener('storage',storage);window.removeEventListener('focus',sync);document.removeEventListener('visibilitychange',visibility);};
 },[]);
 const update=useCallback((value:number)=>setBudgetMillion(writeDashboardBudget(value)),[]);
 return {budgetMillion,setBudgetMillion:update};
}
