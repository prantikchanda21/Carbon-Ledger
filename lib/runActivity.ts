/** Shared lifecycle events for measured browser job activity. */
export function runActivity(id:string,active:boolean,label:string){if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('carbon-job',{detail:{id,active,label,at:performance.now()}}));}
