const express = require("express");
const fs = require("fs");
const TelegramBot = require("node-telegram-bot-api");

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => res.send("✅ Bot Running"));
app.listen(PORT, () => console.log("Server running"));

const token = "8605121015:AAFz-OwQB540Lzs7ak8zxSGS_dopDApoetU";
const bot = new TelegramBot(token, { polling: true });

const ADMIN_IDS = [8521844327,8809115899];
const channels = ["@earnwithmark41"];

let stock = { Hotya: "available", GOSH: "available" };

const FILE = "users.json";
let users = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE)) : {};

function save(){ fs.writeFileSync(FILE, JSON.stringify(users,null,2)); }

function createUser(id){
if(!users[id]){
users[id]={
ref:0,refProgress:0,redeems:0,purchases:0,
buyQtyTotal:0,buyRequest:false,redeemRequest:false,
buyType:null,redeemType:null,screenshot:null,
tempRef:null,referredBy:null
};
save();
}
}

async function checkJoin(id){
try{
for(let ch of channels){
let m = await bot.getChatMember(ch,id);
if(m.status=="left"||m.status=="kicked") return false;
}
return true;
}catch{return false;}
}

/* ================= ADMIN PANEL ================= */
let adminState = { mode:null, target:null };

bot.onText(/\/admin/, (msg)=>{
const id = msg.chat.id;

if(!ADMIN_IDS.includes(id)){
bot.sendMessage(id,"❌ Not admin");
return;
}

bot.sendMessage(id,"🛠 Admin Panel",{
reply_markup:{
keyboard:[
["📊 Status","📢 Broadcast"],
["👤 User Info","✉ Msg User"],
["📦 Stock Manager"]
],
resize_keyboard:true
}
});
});

/* ================= START ================= */
bot.onText(/\/start(?: (.+))?/, async(msg,match)=>{
const id = msg.chat.id;
createUser(id);

if(match[1] && match[1]!=id){
users[id].tempRef = match[1];
save();
}

bot.sendMessage(id,"Join channels first",{
reply_markup:{
inline_keyboard:[
[
{text:"Channel",url:`https://t.me/${channels[0].replace("@","")}`},
],
[{text:"Joined ✅",callback_data:"check_join"}]
]
}
});
});

/* ================= CALLBACK ================= */
bot.on("callback_query", async(q)=>{
const id = q.message.chat.id;
const data = q.data;
const user = users[id];
const adminId = q.from.id;

/* JOIN */
if(data=="check_join"){
let ok = await checkJoin(id);

if(!ok){
bot.answerCallbackQuery(q.id,{text:"Join all channels first ❌",show_alert:true});
return;
}

if(user.tempRef && !user.referredBy){
let r=user.tempRef;
if(users[r]){
users[r].ref++;
users[r].refProgress++;
}
user.referredBy=r;
user.tempRef=null;
save();
}

bot.editMessageText("✅ Access Granted!",{
chat_id:id,
message_id:q.message.message_id
});

bot.sendMessage(id,"Welcome!",{
reply_markup:{
keyboard:[
["👤 Profile","👥 Refer"],
["🎁 Redeem","🛒 Buy Code"]
],
resize_keyboard:true
}
});
}

/* STOCK CONTROL */
if(data=="stock_hotya") stock.Hotya="available";
if(data=="stock_hotya_off") stock.Hotya="over";
if(data=="stock_gosh") stock.GOSH="available";
if(data=="stock_gosh_off") stock.GOSH="over";

/* BUY */
if(data=="buy_hotya"||data=="buy_gosh"){

if(user.buyRequest){
bot.answerCallbackQuery(q.id,{text:"Finish previous order ❌",show_alert:true});
return;
}

let type = data=="buy_hotya"?"Hotya":"GOSH";

if(stock[type]=="over"){
bot.answerCallbackQuery(q.id,{text:"Out of stock ❌",show_alert:true});
return;
}

user.buyType=type;

bot.sendMessage(id,"Select quantity",{
reply_markup:{
inline_keyboard:[
[
{text:"1",callback_data:"qty_1"},
{text:"2",callback_data:"qty_2"},
{text:"5",callback_data:"qty_5"},
{text:"10",callback_data:"qty_10"}
]
]
}
});
}

/* QTY */
if(data.startsWith("qty_")){
let qty=parseInt(data.split("_")[1]);
user.buyQty=qty;
user.buyRequest=true;

bot.sendMessage(id,`Pay ₹${qty*10} and send screenshot`);
save();
}

/* ADMIN BUY */
if(data.startsWith("buyapprove_")){
if(!ADMIN_IDS.includes(adminId)) return;

let uid=data.split("_")[1];
let u=users[uid];

u.buyRequest=false;
u.purchases++;
u.buyQtyTotal+=u.buyQty;

if(u.buyQtyTotal>=5){
u.buyQtyTotal=0;
bot.sendMessage(uid,"🎁 Bonus Code Unlocked!");
}

save();
bot.sendMessage(uid,"✅ Approved");
}

if(data.startsWith("buyreject_")){
if(!ADMIN_IDS.includes(adminId)) return;

let uid=data.split("_")[1];
users[uid].buyRequest=false;
save();
bot.sendMessage(uid,"❌ Rejected");
}

/* REDEEM */
if(data=="redeem_hotya"||data=="redeem_gosh"){

if(user.redeemRequest){
bot.answerCallbackQuery(q.id,{text:"Already requested ❌",show_alert:true});
return;
}

if(user.redeems>=2){
bot.answerCallbackQuery(q.id,{text:"Purchase required ❌",show_alert:true});
return;
}

user.redeemType = data=="redeem_hotya"?"Hotya":"GOSH";
user.redeemRequest=true;
save();

ADMIN_IDS.forEach(a=>{
bot.sendMessage(a,`Redeem request from ${id}`,{
reply_markup:{
inline_keyboard:[
[
{text:"Approve",callback_data:`approve_${id}`},
{text:"Reject",callback_data:`reject_${id}`}
]
]
}
});
});

bot.sendMessage(id,"Redeem request sent ✅");
}

/* APPROVE REDEEM */
if(data.startsWith("approve_")){
let uid=data.split("_")[1];
users[uid].redeems++;
users[uid].redeemRequest=false;
save();
bot.sendMessage(uid,"🎁 Approved");
}

/* REJECT REDEEM */
if(data.startsWith("reject_")){
let uid=data.split("_")[1];
users[uid].redeemRequest=false;
save();
bot.sendMessage(uid,"❌ Rejected");
}

});

/* ================= MESSAGE ================= */
bot.on("message",(msg)=>{
const id = msg.chat.id;
const text = msg.text;
createUser(id);
let user = users[id];

/* BUY MENU */
if(text=="🛒 Buy Code"){
bot.sendMessage(id,"Select Code",{
reply_markup:{
inline_keyboard:[
[
{text:"Hotya",callback_data:"buy_hotya"},
{text:"GOSH",callback_data:"buy_gosh"}
]
]
}
});
}

/* REDEEM MENU */
if(text=="🎁 Redeem"){
bot.sendMessage(id,"Select type",{
reply_markup:{
inline_keyboard:[
[
{text:"Hotya",callback_data:"redeem_hotya"},
{text:"GOSH",callback_data:"redeem_gosh"}
]
]
}
});
}

/* SCREENSHOT */
if(msg.photo && user.buyRequest){
let fileId=msg.photo.pop().file_id;

ADMIN_IDS.forEach(a=>{
bot.sendPhoto(a,fileId,{
caption:`User ${id}`,
reply_markup:{
inline_keyboard:[
[
{text:"Approve",callback_data:`buyapprove_${id}`},
{text:"Reject",callback_data:`buyreject_${id}`}
]
]
}
});
});

bot.sendMessage(id,"Screenshot sent ✅");
}

/* PROFILE */
if(text=="👤 Profile"){
bot.sendMessage(id,`Referrals: ${user.ref}
Purchases: ${user.purchases}
Redeems: ${user.redeems}`);
}

/* REFER */
if(text=="👥 Refer"){
bot.sendMessage(id,`https://t.me/Refer_SellerBot?start=${id}`);
}

/* ================= ADMIN ================= */
if(ADMIN_IDS.includes(id)){

if(text=="📊 Status"){
bot.sendMessage(id,`Users: ${Object.keys(users).length}
Purchases: ${Object.values(users).reduce((a,b)=>a+b.purchases,0)}
Redeems: ${Object.values(users).reduce((a,b)=>a+b.redeems,0)}

Hotya: ${stock.Hotya}
GOSH: ${stock.GOSH}`);
}

/* STOCK */
if(text=="📦 Stock Manager"){
bot.sendMessage(id,"Manage Stock",{
reply_markup:{
inline_keyboard:[
[
{text:"Hotya ON",callback_data:"stock_hotya"},
{text:"Hotya OFF",callback_data:"stock_hotya_off"}
],
[
{text:"GOSH ON",callback_data:"stock_gosh"},
{text:"GOSH OFF",callback_data:"stock_gosh_off"}
]
]
}
});
}

/* BROADCAST */
if(text=="📢 Broadcast"){
adminState.mode="broadcast";
bot.sendMessage(id,"Send message",{reply_markup:{keyboard:[["❌ Cancel"]],resize_keyboard:true}});
return;
}

if(adminState.mode=="broadcast"){
Object.keys(users).forEach(u=>{
bot.sendMessage(u,text).catch(()=>{});
});
bot.sendMessage(id,"✅ Broadcast done");
adminState.mode=null;
}

/* USER INFO */
if(text=="👤 User Info"){
adminState.mode="userinfo";
bot.sendMessage(id,"Send user ID");
return;
}

if(adminState.mode=="userinfo"){
let u=users[text];
if(!u){ bot.sendMessage(id,"❌ Not found"); return; }

bot.sendMessage(id,`ID: ${text}
Ref: ${u.ref}
Purchases: ${u.purchases}
Redeems: ${u.redeems}`);

adminState.mode=null;
}

/* MSG USER */
if(text=="✉ Msg User"){
adminState.mode="msg_id";
bot.sendMessage(id,"Send user ID");
return;
}

if(adminState.mode=="msg_id"){
adminState.target=text;
adminState.mode="msg_send";
bot.sendMessage(id,"Send message");
return;
}

if(adminState.mode=="msg_send"){
bot.sendMessage(adminState.target,text);
bot.sendMessage(id,"✅ Sent");
adminState.mode=null;
adminState.target=null;
}

}

});
