/*
 * @Author: whyour
 * @Github: https://github.com/whyour
 * @Date: 2020-11-29 13:14:19
 * @LastEditors: whyour
 * @LastEditTime: 2021-01-09 17:29:21
 * 本脚本包含京喜耗时任务，默认自动执行，一天执行一两次即可，防止漏网之鱼，可以在box中关闭，然后自己设置定时任务，目前包括
 * 拾取好友与自己零件
 * 厂长翻倍任务
 * 点击厂长任务
  quanx:
  [task_local]
  0 1,18 * * * https://raw.githubusercontent.com/whyour/hundun/master/quanx/jx_factory_component.js, tag=京喜工厂plus, img-url=https://raw.githubusercontent.com/58xinian/icon/master/jdgc.png, enabled=true

  Loon:
  [Script]
  cron "0 1,18 * * *" script-path=https://raw.githubusercontent.com/whyour/hundun/master/quanx/jx_factory_component.js,tag=京喜工厂plus

  Surge:
  京喜工厂plus = type=cron,cronexp="0 1,18 * * *",wake-system=1,timeout=20,script-path=https://raw.githubusercontent.com/whyour/hundun/master/quanx/jx_factory_component.js
*
**/

const $ = new Env('京喜工厂plus');
const JD_API_HOST = 'https://wq.jd.com/';
const jdCookieNode = $.isNode() ? require('./jdCookie.js') : '';
$.authExecute = $.getdata('gc_authExecute') ? $.getdata('gc_authExecute') === 'true' : true;
$.showLog = $.getdata('gc_plusShowLog') ? $.getdata('gc_plusShowLog') === 'true' : false;
$.autoUpgrade = $.getdata('cz_autoUpgrade') ? $.getdata('cz_autoUpgrade') === 'true' : false;
$.result = [];
$.cookieArr = [];
$.currentCookie = '';
$.info = {};
$.count = 0;
$.multiple = 0;
$.time = 0;
$.waitTime = 1000;

!(async () => {
  if (!getCookies()) return;
  for (let i = 0; i < $.cookieArr.length; i++) {
    $.currentCookie = $.cookieArr[i];
    if ($.currentCookie) {
      const userName = decodeURIComponent(
        $.currentCookie.match(/pt_pin=(.+?);/) && $.currentCookie.match(/pt_pin=(.+?);/)[1],
      );
      $.log(`\n开始【京东账号${i + 1}】${userName}`);
      $.result.push(`\n【京东账号${i + 1}】${userName}`);
      const beginInfo = await getUserInfo();
      await $.wait(500);
      await getMyComponent();
      await $.wait(500);
      await getFriends();
      await $.wait(500);
      const endInfo = await getUserInfo();
      // await clickManage();
      // await $.wait(500);
      // await getReadyCard();
      $.result.push(
        `拾取前能量：${beginInfo.user.electric} 拾取后能量：${endInfo.user.electric}`,
        `获得零件能量：${endInfo.user.electric - beginInfo.user.electric}`,
        // `厂长钞票：${$.count}，银行倍数：${$.multiple}`
      );
      // await upgradeUserLevel();
    }
  }
  $.authExecute && await showMsg();
})()
  .catch(e => $.logErr(e))
  .finally(() => $.done());

function getCookies() {
  if ($.isNode()) {
    $.cookieArr = Object.values(jdCookieNode);
  } else {
    const CookiesJd = JSON.parse($.getdata("CookiesJD") || "[]").filter(x => !!x).map(x => x.cookie);
    $.cookieArr = [$.getdata("CookieJD") || "", $.getdata("CookieJD2") || "", ...CookiesJd];
  }
  if (!$.cookieArr[0]) {
    $.msg($.name, '【提示】请先获取京东账号一cookie\n直接使用NobyDa的京东签到获取', 'https://bean.m.jd.com/', {
      'open-url': 'https://bean.m.jd.com/',
    });
    return false;
  }
  return true;
}

function getUserInfo() {
  return new Promise(resolve => {
    $.get(taskUrl('userinfo/GetUserInfo'), async (err, resp, data) => {
      try {
        const { ret, data: { factoryList = [], productionList = [], user = {} } = {}, msg } = JSON.parse(data);
        $.log(`\n获取用户信息：${msg}\n${$.showLog ? data : ''}`);
        $.info = {
          ...$.info,
          factoryInfo: factoryList[0],
          productionInfo: productionList[0],
          user,
        };
        resolve({
          factoryInfo: factoryList[0],
          productionInfo: productionList[0],
          user,
        });
      } catch (e) {
        $.logErr(e, resp);
      } finally {
        resolve();
      }
    });
  });
}

async function getMyComponent() {
  let meStatus = [false];
  if (!meStatus[0]) {
    meStatus[0] = await pickUserComponents($.info.user.encryptPin, true);
  }
  if (!meStatus[0] && $.authExecute) {
    await $.wait(5000);
    await getMyComponent();
  }
}

function getFriends() {
  return new Promise(async resolve => {
    $.get(taskUrl('friend/QueryFactoryManagerList'), async (err, resp, data) => {
      try {
        const { msg, data: { list = [] } = {} } = JSON.parse(data);
        $.log(`\n获取工厂好友：${msg}\n${$.showLog ? data : ''}`);
        let statusArr = [];
        for (let i = 0; i < list.length; i++) {
          const { encryptPin } = list[i];
          let status = [false];
          if (!status[0]) {
            await $.wait(5000);
            status[0] = await pickUserComponents(encryptPin);
            statusArr.push(status[0]);
          }
          if (status[0]) {
            break;
          }
        }
        if (!statusArr[statusArr.length - 1] && $.authExecute) {
          await $.wait(5000);
          await getFriends();
        }
      } catch (e) {
        $.logErr(e, resp);
      } finally {
        resolve();
      }
    });
  });
}

function pickUserComponents(pin, isMe) {
  return new Promise(async resolve => {
    $.get(taskUrl('usermaterial/GetUserComponent', `pin=${pin}`), async (err, resp, data) => {
      try {
        const { msg, data: { componentList = [] } = {} } = JSON.parse(data);
        $.log(`\n获取${isMe ? '自己' : '好友'}零件：${msg}\n${$.showLog ? data : ''}`);
        if (componentList.length > 0) {
          let statusArr = [];
          for (let i = 0; i < componentList.length; i++) {
            const { placeId } = componentList[i];
            let status = [false];
            if (!status[0]) {
              await $.wait(2000);
              status[0] = await pickUpComponent(placeId, pin, isMe);
              statusArr.push(status[0]);
            }
            if (status[0]) {
              break;
            }
          }
          if (statusArr[statusArr.length - 1]) {
            resolve(true);
          } else {
            resolve(false);
          }
        } else if (isMe) {
          resolve(true);
        }
      } catch (e) {
        $.logErr(e, resp);
      } finally {
        resolve();
      }
    });
  });
}

function pickUpComponent(placeId, pin, isMe) {
  return new Promise(async resolve => {
    $.get(taskUrl('usermaterial/PickUpComponent', `pin=${pin}&placeId=${placeId}&_stk=_time%2Cpin%2CplaceId%2Czone`), (err, resp, data) => {
      try {
        const { msg, data: { increaseElectric } = {} } = JSON.parse(data);
        $.log(
          `\n拾取${isMe ? '自己' : '好友'}零件：${msg}，获得电力 ${increaseElectric || 0}\n${$.showLog ? data : ''}`,
        );
        if (!increaseElectric) {
          resolve(true);
        } else {
          resolve(false);
        }
      } catch (e) {
        $.logErr(e, resp);
      } finally {
        resolve();
      }
    });
  });
}

function upgradeUserLevel() {
  return new Promise(async resolve => {
    if (!$.autoUpgrade) {
      resolve();
      return;
    }
    $.get(taskStroyUrl('userinfo/UpgradeUserLevelDraw'), async (err, resp, data) => {
      try {
        const { msg, data: { discount, quota, currentUserLevel, consumeMoneyNum, active } = {}, ret } = JSON.parse(data);
        let str = '';
        if (discount && quota) {
          str = `，获得满${quota}减${discount}红包`;
        }
        if (ret === 0) {
          if (active) {
            $.time++;
          }
          $.log(`\n投入钞票：${msg}，消耗钞票${consumeMoneyNum}，当前等级 ${currentUserLevel}${str ? str : ''}\n${$.showLog ? data : ''}`);
          await upgradeUserLevel();
        } else {
          currentUserLevel && $.result.push(
            `厂长从${currentUserLevel-$.time}级升到${currentUserLevel}`,
          );
        }
      } catch (e) {
        $.logErr(e, resp);
      } finally {
        resolve();
      }
    });
  });
}

function clickManage() {
  return new Promise(resolve => {
    $.get(taskStroyUrl('userinfo/IncreaseUserMoney'), async (err, resp, _data) => {
      try {
        const { ret, data: { moneyNum = 0 } = {}, msg } = JSON.parse(_data);
        $.log(`\n点击厂长：${msg}，获得钞票 ${moneyNum}\n${$.showLog ? _data : ''}`);
        $.count += moneyNum;
        if (ret === 0 && $.authExecute) {
          await $.wait($.waitTime);
          await clickManage();
        } else if(msg.indexOf('点击的频率') !== -1) {
          $.waitTime += 500;
          await $.wait(3000);
          await clickManage();
        }
      } catch (e) {
        $.logErr(e, resp);
      } finally {
        resolve();
      }
    });
  });
}

function getReadyCard() {
  return new Promise(async resolve => {
    $.get(taskStroyUrl('userinfo/ReadyCard'), async (err, resp, data) => {
      try {
        const { ret, data: { cardInfo = [] } = {}, msg } = JSON.parse(data);
        $.log(`\n获取翻倍列表 ${msg}，总共${cardInfo.length}个卡片！${cardInfo.length ? '随机选择一个卡片' : ''}`);
        if (cardInfo.length > 0) {
          await selectCard(cardInfo);
        }
      } catch (e) {
        $.logErr(e, resp);
      } finally {
        resolve();
      }
    });
  });
}

function selectCard(cardInfo) {
  return new Promise(async resolve => {
    const random = Math.floor(Math.random() * 3);
    const cardList = [...cardInfo].map((x, i) => {
      return {
        cardId: x.cardId,
        cardPosition: i + 1,
        cardStatus: i === random ? 1 : 0,
      };
    });
    $.get(
      taskStroyUrl('userinfo/SelectCard', `cardInfo=${encodeURIComponent(JSON.stringify({ cardInfo: cardList }))}`),
      async (err, resp, data) => {
        try {
          const { ret, msg } = JSON.parse(data);
          $.log(`\n选择翻倍卡片 ${msg}`);
          await $.wait(10300);
          await finishCard(cardInfo[random]);
        } catch (e) {
          $.logErr(e, resp);
        } finally {
          resolve();
        }
      },
    );
  });
}

function finishCard({ cardId }) {
  return new Promise(async resolve => {
    $.get(taskStroyUrl('userinfo/FinishCard', `cardid=${cardId}`), async (err, resp, data) => {
      try {
        const { ret, data: { cardInfo = [], earnRatio } = {}, msg } = JSON.parse(data);
        $.log(`\n翻倍 ${msg}，获得倍数 ${earnRatio || 0}`);
        $.multiple += earnRatio;
        if (ret === 0 && $.authExecute && earnRatio) {
          await getReadyCard()
        }
      } catch (e) {
        $.logErr(e, resp);
      } finally {
        resolve();
      }
    });
  });
}

function showMsg() {
  return new Promise(resolve => {
    $.msg($.name, '', `\n${$.result.join('\n')}`);
    resolve();
  });
}

function taskUrl(function_path, body) {
  return {
    url: `${JD_API_HOST}dreamfactory/${function_path}?zone=dream_factory&sceneval=2&g_login_type=1&&_time=${Date.now()}&_=${Date.now()}&${body}`,
    headers: {
      Cookie: $.currentCookie,
      Accept: `*/*`,
      Connection: `keep-alive`,
      Referer: `https://wqsd.jd.com/pingou/dream_factory/index.html?jxsid=16064615029143314965&exchange=&ptag=139045.1.2&from_source=outer&jump_rd=17088.24.47&deepLink=1`,
      'Accept-Encoding': `gzip, deflate, br`,
      Host: `wq.jd.com`,
      'User-Agent': `jdpingou;iPhone;3.15.2;14.2.1;ea00763447803eb0f32045dcba629c248ea53bb3;network/3g;model/iPhone13,2;appBuild/100365;ADID/00000000-0000-0000-0000-000000000000;supportApplePay/1;hasUPPay/0;pushNoticeIsOpen/0;hasOCPay/0;supportBestPay/0;session/4;pap/JA2015_311210;brand/apple;supportJDSHWK/1;Mozilla/5.0 (iPhone; CPU iPhone OS 14_2_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148`,
      'Accept-Language': `zh-cn`,
    },
  };
}

function taskStroyUrl(function_path, body) {
  return {
    url: `${JD_API_HOST}jxstory/${function_path}?bizcode=jxstory&sceneval=2&g_login_type=1&&_time=${Date.now()}&_=${Date.now()}&${body}`,
    headers: {
      Cookie: $.currentCookie,
      Accept: `*/*`,
      Connection: `keep-alive`,
      Referer: `https://st.jingxi.com/pingou/jx_factory_story/index.html`,
      'Accept-Encoding': `gzip, deflate, br`,
      Host: `m.jingxi.com`,
      'User-Agent': `jdpingou;iPhone;3.15.2;14.2.1;ea00763447803eb0f32045dcba629c248ea53bb3;network/wifi;model/iPhone13,2;appBuild/100365;ADID/00000000-0000-0000-0000-000000000000;supportApplePay/1;hasUPPay/0;pushNoticeIsOpen/0;hasOCPay/0;supportBestPay/0;session/${
        Math.random * 98 + 1
      };pap/JA2015_311210;brand/apple;supportJDSHWK/1;Mozilla/5.0 (iPhone; CPU iPhone OS 14_2_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148`,
      'Accept-Language': `zh-cn`,
    },
  };
}

// prettier-ignore
function Env(t,e){class s{constructor(t){this.env=t}send(t,e="GET"){t="string"==typeof t?{url:t}:t;let s=this.get;return"POST"===e&&(s=this.post),new Promise((e,i)=>{s.call(this,t,(t,s,r)=>{t?i(t):e(s)})})}get(t){return this.send.call(this.env,t)}post(t){return this.send.call(this.env,t,"POST")}}return new class{constructor(t,e){this.name=t,this.http=new s(this),this.data=null,this.dataFile="box.dat",this.logs=[],this.isMute=!1,this.isNeedRewrite=!1,this.logSeparator="\n",this.startTime=(new Date).getTime(),Object.assign(this,e),this.log("",`\ud83d\udd14${this.name}, \u5f00\u59cb!`)}isNode(){return"undefined"!=typeof module&&!!module.exports}isQuanX(){return"undefined"!=typeof $task}isSurge(){return"undefined"!=typeof $httpClient&&"undefined"==typeof $loon}isLoon(){return"undefined"!=typeof $loon}toObj(t,e=null){try{return JSON.parse(t)}catch{return e}}toStr(t,e=null){try{return JSON.stringify(t)}catch{return e}}getjson(t,e){let s=e;const i=this.getdata(t);if(i)try{s=JSON.parse(this.getdata(t))}catch{}return s}setjson(t,e){try{return this.setdata(JSON.stringify(t),e)}catch{return!1}}getScript(t){return new Promise(e=>{this.get({url:t},(t,s,i)=>e(i))})}runScript(t,e){return new Promise(s=>{let i=this.getdata("@chavy_boxjs_userCfgs.httpapi");i=i?i.replace(/\n/g,"").trim():i;let r=this.getdata("@chavy_boxjs_userCfgs.httpapi_timeout");r=r?1*r:20,r=e&&e.timeout?e.timeout:r;const[o,h]=i.split("@"),a={url:`http://${h}/v1/scripting/evaluate`,body:{script_text:t,mock_type:"cron",timeout:r},headers:{"X-Key":o,Accept:"*/*"}};this.post(a,(t,e,i)=>s(i))}).catch(t=>this.logErr(t))}loaddata(){if(!this.isNode())return{};{this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const t=this.path.resolve(this.dataFile),e=this.path.resolve(process.cwd(),this.dataFile),s=this.fs.existsSync(t),i=!s&&this.fs.existsSync(e);if(!s&&!i)return{};{const i=s?t:e;try{return JSON.parse(this.fs.readFileSync(i))}catch(t){return{}}}}}writedata(){if(this.isNode()){this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const t=this.path.resolve(this.dataFile),e=this.path.resolve(process.cwd(),this.dataFile),s=this.fs.existsSync(t),i=!s&&this.fs.existsSync(e),r=JSON.stringify(this.data);s?this.fs.writeFileSync(t,r):i?this.fs.writeFileSync(e,r):this.fs.writeFileSync(t,r)}}lodash_get(t,e,s){const i=e.replace(/\[(\d+)\]/g,".$1").split(".");let r=t;for(const t of i)if(r=Object(r)[t],void 0===r)return s;return r}lodash_set(t,e,s){return Object(t)!==t?t:(Array.isArray(e)||(e=e.toString().match(/[^.[\]]+/g)||[]),e.slice(0,-1).reduce((t,s,i)=>Object(t[s])===t[s]?t[s]:t[s]=Math.abs(e[i+1])>>0==+e[i+1]?[]:{},t)[e[e.length-1]]=s,t)}getdata(t){let e=this.getval(t);if(/^@/.test(t)){const[,s,i]=/^@(.*?)\.(.*?)$/.exec(t),r=s?this.getval(s):"";if(r)try{const t=JSON.parse(r);e=t?this.lodash_get(t,i,""):e}catch(t){e=""}}return e}setdata(t,e){let s=!1;if(/^@/.test(e)){const[,i,r]=/^@(.*?)\.(.*?)$/.exec(e),o=this.getval(i),h=i?"null"===o?null:o||"{}":"{}";try{const e=JSON.parse(h);this.lodash_set(e,r,t),s=this.setval(JSON.stringify(e),i)}catch(e){const o={};this.lodash_set(o,r,t),s=this.setval(JSON.stringify(o),i)}}else s=this.setval(t,e);return s}getval(t){return this.isSurge()||this.isLoon()?$persistentStore.read(t):this.isQuanX()?$prefs.valueForKey(t):this.isNode()?(this.data=this.loaddata(),this.data[t]):this.data&&this.data[t]||null}setval(t,e){return this.isSurge()||this.isLoon()?$persistentStore.write(t,e):this.isQuanX()?$prefs.setValueForKey(t,e):this.isNode()?(this.data=this.loaddata(),this.data[e]=t,this.writedata(),!0):this.data&&this.data[e]||null}initGotEnv(t){this.got=this.got?this.got:require("got"),this.cktough=this.cktough?this.cktough:require("tough-cookie"),this.ckjar=this.ckjar?this.ckjar:new this.cktough.CookieJar,t&&(t.headers=t.headers?t.headers:{},void 0===t.headers.Cookie&&void 0===t.cookieJar&&(t.cookieJar=this.ckjar))}get(t,e=(()=>{})){t.headers&&(delete t.headers["Content-Type"],delete t.headers["Content-Length"]),this.isSurge()||this.isLoon()?(this.isSurge()&&this.isNeedRewrite&&(t.headers=t.headers||{},Object.assign(t.headers,{"X-Surge-Skip-Scripting":!1})),$httpClient.get(t,(t,s,i)=>{!t&&s&&(s.body=i,s.statusCode=s.status),e(t,s,i)})):this.isQuanX()?(this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>e(t))):this.isNode()&&(this.initGotEnv(t),this.got(t).on("redirect",(t,e)=>{try{if(t.headers["set-cookie"]){const s=t.headers["set-cookie"].map(this.cktough.Cookie.parse).toString();s&&this.ckjar.setCookieSync(s,null),e.cookieJar=this.ckjar}}catch(t){this.logErr(t)}}).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>{const{message:s,response:i}=t;e(s,i,i&&i.body)}))}post(t,e=(()=>{})){if(t.body&&t.headers&&!t.headers["Content-Type"]&&(t.headers["Content-Type"]="application/x-www-form-urlencoded"),t.headers&&delete t.headers["Content-Length"],this.isSurge()||this.isLoon())this.isSurge()&&this.isNeedRewrite&&(t.headers=t.headers||{},Object.assign(t.headers,{"X-Surge-Skip-Scripting":!1})),$httpClient.post(t,(t,s,i)=>{!t&&s&&(s.body=i,s.statusCode=s.status),e(t,s,i)});else if(this.isQuanX())t.method="POST",this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>e(t));else if(this.isNode()){this.initGotEnv(t);const{url:s,...i}=t;this.got.post(s,i).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>{const{message:s,response:i}=t;e(s,i,i&&i.body)})}}time(t){let e={"M+":(new Date).getMonth()+1,"d+":(new Date).getDate(),"H+":(new Date).getHours(),"m+":(new Date).getMinutes(),"s+":(new Date).getSeconds(),"q+":Math.floor(((new Date).getMonth()+3)/3),S:(new Date).getMilliseconds()};/(y+)/.test(t)&&(t=t.replace(RegExp.$1,((new Date).getFullYear()+"").substr(4-RegExp.$1.length)));for(let s in e)new RegExp("("+s+")").test(t)&&(t=t.replace(RegExp.$1,1==RegExp.$1.length?e[s]:("00"+e[s]).substr((""+e[s]).length)));return t}msg(e=t,s="",i="",r){const o=t=>{if(!t)return t;if("string"==typeof t)return this.isLoon()?t:this.isQuanX()?{"open-url":t}:this.isSurge()?{url:t}:void 0;if("object"==typeof t){if(this.isLoon()){let e=t.openUrl||t.url||t["open-url"],s=t.mediaUrl||t["media-url"];return{openUrl:e,mediaUrl:s}}if(this.isQuanX()){let e=t["open-url"]||t.url||t.openUrl,s=t["media-url"]||t.mediaUrl;return{"open-url":e,"media-url":s}}if(this.isSurge()){let e=t.url||t.openUrl||t["open-url"];return{url:e}}}};if(this.isMute||(this.isSurge()||this.isLoon()?$notification.post(e,s,i,o(r)):this.isQuanX()&&$notify(e,s,i,o(r))),!this.isMuteLog){let t=["","==============\ud83d\udce3\u7cfb\u7edf\u901a\u77e5\ud83d\udce3=============="];t.push(e),s&&t.push(s),i&&t.push(i),console.log(t.join("\n")),this.logs=this.logs.concat(t)}}log(...t){t.length>0&&(this.logs=[...this.logs,...t]),console.log(t.join(this.logSeparator))}logErr(t,e){const s=!this.isSurge()&&!this.isQuanX()&&!this.isLoon();s?this.log("",`\u2757\ufe0f${this.name}, \u9519\u8bef!`,t.stack):this.log("",`\u2757\ufe0f${this.name}, \u9519\u8bef!`,t)}wait(t){return new Promise(e=>setTimeout(e,t))}done(t={}){const e=(new Date).getTime(),s=(e-this.startTime)/1e3;this.log("",`\ud83d\udd14${this.name}, \u7ed3\u675f! \ud83d\udd5b ${s} \u79d2`),this.log(),(this.isSurge()||this.isQuanX()||this.isLoon())&&$done(t)}}(t,e)}
