const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "results.json");
const syllabus = require("./syllabus.json");
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));
fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, "[]");
const recent = new Map();
function readResults(){ try { return JSON.parse(fs.readFileSync(DB_FILE,"utf8")); } catch { return []; } }
function writeResults(rows){ fs.writeFileSync(DB_FILE, JSON.stringify(rows,null,2)); }
function rateLimit(req,res,next){
  const ip=(req.headers["x-forwarded-for"]||req.socket.remoteAddress||"unknown").toString().split(",")[0];
  const now=Date.now(), prev=recent.get(ip)||0;
  if(now-prev<12000) return res.status(429).json({error:"Please wait a few seconds before generating another test."});
  recent.set(ip,now); next();
}
app.get("/api/syllabus",(req,res)=>res.json(syllabus));
app.get("/api/status",(req,res)=>res.json({aiReady:Boolean(process.env.OPENAI_API_KEY), model:process.env.OPENAI_MODEL||"gpt-4.1-mini"}));

app.post("/api/generate", rateLimit, async (req,res)=>{
  try{
    const {grade,subject,chapter,count}=req.body||{};
    if(!syllabus[String(grade)] || !syllabus[String(grade)][subject] || !syllabus[String(grade)][subject].includes(chapter))
      return res.status(400).json({error:"Please choose a valid class, subject and chapter from the catalogue."});
    const n=Math.max(5,Math.min(50,Number(count)||20));
    if(!process.env.OPENAI_API_KEY) return res.status(503).json({error:"AI is not configured yet. Add OPENAI_API_KEY in the hosting environment. Do not put the key in the browser."});
    const schema={type:"object",additionalProperties:false,properties:{questions:{type:"array",items:{type:"object",additionalProperties:false,properties:{question:{type:"string"},options:{type:"array",items:{type:"string"}},correctIndex:{type:"integer",minimum:0,maximum:3},explanation:{type:"string"},difficulty:{type:"string",enum:["Easy","Medium","Hard"]}},required:["question","options","correctIndex","explanation","difficulty"]}}},required:["questions"]};
    const prompt=`Create exactly ${n} original multiple-choice practice questions for CBSE/NCERT-style study. Class: ${grade}. Subject: ${subject}. Chapter/unit: ${chapter}. Use age-appropriate language and accurate concepts appropriate to this class. Each question must have exactly four plausible options and one unambiguously correct answer. Vary difficulty across Easy, Medium, Hard. Include a concise explanation. Do not claim these are official CBSE questions or predict exam questions. Avoid duplicates, trick wording, and unsupported facts. For English literature, focus on the actual named text if identifiable; if chapter details are uncertain, say so through cautious questions on widely established plot/themes, not invented details. Return only schema-conforming data.`;
    const apiResp=await fetch("https://api.openai.com/v1/responses",{
      method:"POST",
      headers:{"Authorization":`Bearer ${process.env.OPENAI_API_KEY}`,"Content-Type":"application/json"},
      body:JSON.stringify({model:process.env.OPENAI_MODEL||"gpt-4.1-mini",input:[{role:"system",content:"You are a careful school practice-question writer. Accuracy is more important than cleverness."},{role:"user",content:prompt}],text:{format:{type:"json_schema",name:"mcq_test",strict:true,schema}}})
    });
    const data=await apiResp.json();
    if(!apiResp.ok) return res.status(502).json({error:data.error?.message||"AI question generation failed. Check the API key, model and billing settings."});
    let raw="";
    for(const item of (data.output||[])){ if(item.type==="message") for(const c of (item.content||[])) if(c.type==="output_text") raw+=c.text; }
    let parsed; try{parsed=JSON.parse(raw)}catch{return res.status(502).json({error:"The AI response could not be read. Please try again."});}
    if(!parsed.questions||parsed.questions.length!==n) return res.status(502).json({error:"The AI returned an incomplete test. Please try again."});
    const id=crypto.randomUUID();
    const questions=parsed.questions.map((q,i)=>({id:i+1,question:q.question,options:q.options,correctIndex:q.correctIndex,explanation:q.explanation,difficulty:q.difficulty}));
    res.json({testId:id,grade:String(grade),subject,chapter,count:n,questions});
  }catch(e){console.error(e);res.status(500).json({error:"Something went wrong while creating the test."});}
});

app.post("/api/submit",(req,res)=>{
  try{
    const {student,grade,subject,chapter,score,total,correct,wrong,unanswered,percent,durationSeconds}=req.body||{};
    if(!grade||!subject||!chapter||!Number.isFinite(Number(score))||!Number.isFinite(Number(total))||Number(total)<1||Number(total)>50)
      return res.status(400).json({error:"Invalid result data."});
    const row={id:crypto.randomUUID(),student:String(student||"Student").trim().slice(0,60)||"Student",grade:String(grade),subject:String(subject).slice(0,80),chapter:String(chapter).slice(0,140),score:Number(score),total:Number(total),correct:Number(correct)||0,wrong:Number(wrong)||0,unanswered:Number(unanswered)||0,percent:Math.max(0,Math.min(100,Number(percent)||0)),durationSeconds:Math.max(0,Number(durationSeconds)||0),createdAt:new Date().toISOString()};
    const rows=readResults(); rows.push(row); writeResults(rows.slice(-5000)); res.json({ok:true,id:row.id});
  }catch(e){console.error(e);res.status(500).json({error:"Could not save result."});}
});
app.get("/api/leaderboard",(req,res)=>{
  const grade=String(req.query.grade||"");
  let rows=readResults();
  if(grade) rows=rows.filter(r=>r.grade===grade);
  rows.sort((a,b)=>b.percent-a.percent || b.score-a.score || a.durationSeconds-b.durationSeconds);
  res.json(rows.slice(0,100));
});
app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(PORT,()=>console.log(`CBSE AI Test Portal running on ${PORT}`));
