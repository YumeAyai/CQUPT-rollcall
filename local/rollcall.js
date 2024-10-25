const fs = require("fs");
const crypto = require("crypto");
const headers = require("./header.json");

// 检查课程列表
function checkCourseList() {
  const optionsUrl =
    "http://lms.tc.cqupt.edu.cn/api/radar/rollcalls?api_version=1.1.0";

  return fetch(optionsUrl, {
    method: "GET",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Linux; Android 14; PGU110 Build/UKQ1.230924.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/109.0.5414.86 MQQBrowser/6.2 TBS/046913 Mobile Safari/537.36 wxwork/4.1.20 MicroMessenger/7.0.1 NetType/4G Language/zh Lang/zh ColorScheme/Light",
      "Accept": "application/json, text/plain",
      "Accept-Encoding": "gzip, deflate",
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
      "X-SESSION-ID": headers.Cookie.match(/session=(.+?);/)[1], // 从当前 Cookie 中提取 session ID
      "Accept-Language": "zh-Hans",
      "Origin": "http://mobile.tc.cqupt.edu.cn",
      "Referer": "http://mobile.tc.cqupt.edu.cn/",

      // 新增的 CORS 和连接控制字段
      "Access-Control-Allow-Headers":
        "Authorization,DNT,X-SESSION-ID,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Expose-Headers": "X-SESSION-ID",
      "Connection": "keep-alive",
      "Proxy-Connection": "keep-alive",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "SAMEORIGIN",

      // 可以添加额外的 headers
      ...headers, // 这里是从外部传入的 headers（如有）
    },
  })
    .then((response) => {
      console.log(response);
      if (!response.ok) throw new Error("网络请求失败");
      const setCookieHeader = response.headers.get("Set-Cookie");
      console.log("Set-Cookie:", setCookieHeader);

      // 更新Cookie
      if (setCookieHeader) {
        headers.Cookie = setCookieHeader;
        fs.writeFileSync("header.json", JSON.stringify(headers, null, 2));
      }

      return response.json();
    })
    .then((options) => {
      console.log("课程列表:", options["rollcalls"]);

      if (options["rollcalls"].length === 0) {
        console.log("没有进行点名的课程");
        return [];
      }

      // 保存课程列表日志到文件
      fs.writeFileSync(
        "rollcalls.json",
        JSON.stringify(options["rollcalls"], null, 2),
      );

      // 并发签到
      const promises = options["rollcalls"].map((option) => {
        if (option["source"] === "number") {
          return numericSignIn(option["rollcall_id"]);
        }
        return qrCodeSignIn(option["course_id"], option["rollcall_id"]);
      });

      Promise.all(promises)
        .then((results) => {
          console.log("所有签到结果:", results);
          return options["rollcalls"].map((option) => option["course_title"]);
        })
        .catch((error) => {
          console.error("签到过程中出现错误:", error);
        });

      return options["rollcalls"].map((option) => option["course_title"]);
    })
    .catch((error) => {
      console.error("获取课程列表出错:", error);
      return [];
    });
}

// 二维码签到
function qrCodeSignIn(courseId, rollcallId) {
  // 获取二维码
  const qrCodeUrl =
    `http://lms.tc.cqupt.edu.cn/api/course/${courseId}/rollcall/${rollcallId}/qr_code`;
  return fetch(qrCodeUrl, {
    method: "GET",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Linux; Android 14; PGU110 Build/UKQ1.230924.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/109.0.5414.86 MQQBrowser/6.2 TBS/046913 Mobile Safari/537.36 wxwork/4.1.20 MicroMessenger/7.0.1 NetType/4G Language/zh Lang/zh ColorScheme/Light",
      "Accept": "application/json, text/plain",
      "Accept-Encoding": "gzip, deflate",
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
      "X-SESSION-ID": headers.Cookie.match(/session=(.+?);/)[1],
      "Accept-Language": "zh-Hans",
      "Origin": "http://mobile.tc.cqupt.edu.cn",
      "Referer": "http://mobile.tc.cqupt.edu.cn/",
    },
  })
    .then((response) => {
      if (!response.ok) {
        return response.json().then((errorMsg) => {
          throw new Error(`获取二维码失败: ${errorMsg}`);
        });
      }
      return response.json().then((qrCodeData) => {
        const session = response.headers.get("X-SESSION-ID");
        return { qrCodeData, session }; // 返回对象
      });
    })
    .then(({ qrCodeData, session }) => {
      console.log("二维码数据:", qrCodeData);
      const signInUrl =
        `http://lms.tc.cqupt.edu.cn/api/rollcall/${rollcallId}/answer_qr_rollcall`;
      const body = JSON.stringify({
        data: qrCodeData.data,
        deviceId: ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
          (c ^ crypto.randomBytes(1)[0] & 15 >> c / 4).toString(16)
        ),
      });

      return fetch(signInUrl, {
        method: "PUT",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Linux; Android 14; PGU110 Build/UKQ1.230924.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/109.0.5414.86 MQQBrowser/6.2 TBS/046913 Mobile Safari/537.36 wxwork/4.1.20 MicroMessenger/7.0.1 NetType/4G Language/zh Lang/zh ColorScheme/Light",
          "Accept": "application/json, text/plain",
          "Accept-Encoding": "gzip, deflate",
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
          "X-SESSION-ID": session,
          "Accept-Language": "zh-Hans",
          "Origin": "http://mobile.tc.cqupt.edu.cn",
          "Referer": "http://mobile.tc.cqupt.edu.cn/",
        },
        body: body,
      });
    })
    .then((signInResponse) => {
      if (!signInResponse.ok) {
        return signInResponse.text().then((errorMsg) => {
          throw new Error(`签到提交失败: ${errorMsg}`);
        });
      }
      return signInResponse.json();
    })
    .then((signInResult) => {
      console.log("签到结果:", signInResult);
      return signInResult;
    })
    .catch((error) => {
      console.error("二维码自动签到出错:", error);
    });
}

// 数字签到
function numericSignIn(rollcallId) {
  const statusUrl =
    `http://lms.tc.cqupt.edu.cn/api/courses/rollcall_status/${rollcallId}/result`;

  return fetch(statusUrl, {
    method: "GET",
    headers: headers,
  })
    .then((response) => {
      if (!response.ok) throw new Error("网络请求失败");
      return response.json();
    })
    .then((data) => {
      // console.log("签到状态:", data);
      return data.number_code; // 返回数字签到码
    })
    .then((numberCode) => {
      const signInUrl =
        `http://lms.tc.cqupt.edu.cn/api/rollcall/${rollcallId}/answer_number_rollcall`;
      const body = JSON.stringify({ numberCode });

      return fetch(signInUrl, {
        method: "PUT",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Linux; Android 14; PGU110 Build/UKQ1.230924.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/109.0.5414.86 MQQBrowser/6.2 TBS/046913 Mobile Safari/537.36 wxwork/4.1.20 MicroMessenger/7.0.1 NetType/4G Language/zh Lang/zh ColorScheme/Light",
          "Accept": "application/json, text/plain",
          "Accept-Encoding": "gzip, deflate",
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
          "X-SESSION-ID": headers.Cookie.match(/session=(.+?);/)[1],
          "Accept-Language": "zh-Hans",
          "Origin": "http://mobile.tc.cqupt.edu.cn",
          "Referer": "http://mobile.tc.cqupt.edu.cn/",
        },
        body: body,
      });
    })
    .then((response) => {
      if (!response.ok) throw new Error("签到提交失败");
      return response.json();
    })
    .then((result) => {
      console.log("签到提交结果:", result);
    })
    .catch((error) => {
      console.error("出错:", error);
    });
}

// 示例用法
checkCourseList().then((courseTitles) => {
  courseTitles.forEach((courseTitle) => {
    console.log(`尝试签到课程: ${courseTitle}`);
  });
});