type ReviewTask = {
 task_key?: string; status?: string; error?: string;
 mockups?: {mockup_url:string}[];
};
/** Completed responses also include task_key; completion must take precedence. */
export function reviewMockupResult(result:ReviewTask){
 if(result.status==="failed")throw new Error(result.error??"Printful could not render this design");
 if(result.status==="completed"){
  const image=result.mockups?.[0]?.mockup_url;
  if(!image)throw new Error("Printful completed without a preview image.");
  return {image,taskKey:null};
 }
 return {image:null,taskKey:result.task_key??null};
}
