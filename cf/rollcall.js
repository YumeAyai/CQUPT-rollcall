'use strict';
const cloudbase = require('@cloudbase/node-sdk');
const crypto = require('crypto');
const app = cloudbase.init({});
var db = app.database();

// 检查课程列表
async function checkCourseList(_id, headers) {
    const optionsUrl = "http://lms.tc.cqupt.edu.cn/api/radar/rollcalls?api_version=1.1.0";

    return fetch(optionsUrl, {
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
            ...headers,
        },
    })
        .then(async (response) => {
            if (!response.ok) throw new Error("网络请求失败");
            const setCookieHeader = response.headers.get("Set-Cookie");
            console.log("Set-Cookie:", setCookieHeader);

            // 更新Cookie
            if (setCookieHeader) {
                headers.Cookie = setCookieHeader;
                await db.collection('token').doc(_id).update({ session: JSON.stringify(headers) })
            }

            return response.json();
        })
        .then((options) => {
            console.log("课程列表:", options["rollcalls"]);

            if (options["rollcalls"].length === 0) {
                console.log("没有进行点名的课程");
                return ["没有进行点名的课程"];
            }

            // 并发签到
            // const promises = options["rollcalls"].map((option) => {
            //     if (option["source"] === "number") {
            //         return numericSignIn(headers, option["rollcall_id"])
            //             .then(result => ({
            //                 user: _id,
            //                 title: option["course_title"],
            //                 result: result,
            //             }));
            //     }
            //     return qrCodeSignIn(headers, option["course_id"], option["rollcall_id"])
            //         .then(result => ({
            //             user: _id,
            //             title: option["course_title"],
            //             result: result,
            //         }));
            // });

            const promises = options["rollcalls"].map((option) => {
                const signInFunction = option["source"] === "number" ? numericSignIn : qrCodeSignIn;
                const args = option["source"] === "number"
                    ? [headers, option["rollcall_id"]]
                    : [headers, option["course_id"], option["rollcall_id"]];

                return signInFunction(...args)
                    .then(result => ({
                        user: _id,
                        title: option["course_title"],
                        result: result,
                    }));
            });

            return Promise.all(promises)
                .then((results) => {
                    console.log("所有签到结果:", results);
                    return options["rollcalls"].map((option) => results);
                })
                .catch((error) => {
                    console.error("签到过程中出现错误:", error);
                });
        })
        .catch((error) => {
            console.error("获取课程列表出错:", error);
            return ["获取课程列表出错"];
        });
}

// 二维码签到
async function qrCodeSignIn(headers, courseId, rollcallId) {
    const qrCodeUrl = `http://lms.tc.cqupt.edu.cn/api/course/${courseId}/rollcall/${rollcallId}/qr_code`;

    return fetch(qrCodeUrl, {
        method: "GET",
        headers: headers,
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
            const signInUrl = `http://lms.tc.cqupt.edu.cn/api/rollcall/${rollcallId}/answer_qr_rollcall`;
            const body = JSON.stringify({
                data: qrCodeData.data,
                deviceId: ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
                    (c ^ crypto.randomBytes(1)[0] & 15 >> c / 4).toString(16)
                ),
            });
            return new Promise((resolve) => setTimeout(() => resolve(signInUrl, body, session), 100));
        })
        .then((signInUrl, body, session) => {
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
                return signInResponse.text().then(errorMsg => {
                    throw new Error(`签到提交失败: ${errorMsg}`);
                });
            }
            return signInResponse.json();
        })
        .then((signInResult) => {
            console.log("签到结果:", signInResult);
        })
        .catch((error) => {
            console.error("二维码自动签到出错:", error);
        });
}

// 数字签到
async function numericSignIn(headers, rollcallId) {
    const statusUrl = `http://lms.tc.cqupt.edu.cn/api/courses/rollcall_status/${rollcallId}/result`;

    return fetch(statusUrl, {
        method: "GET",
        headers: headers,
    })
        .then((response) => {
            if (!response.ok) throw new Error("网络请求失败");
            return response.json();
        })
        .then((data) => {
            return data.number_code;
        })
        .then((numberCode) => {
            const signInUrl = `http://lms.tc.cqupt.edu.cn/api/rollcall/${rollcallId}/answer_number_rollcall`;
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
            if (!response.ok) {
                return response.text().then(errorMsg => {
                    throw new Error(`签到提交失败: ${errorMsg}`);
                });
            }
            return response.json();
        })
        .then((result) => {
            console.log("签到提交结果:", result);
        })
        .catch((error) => {
            console.error("出错:", error);
        });
}

// 云函数主入口
exports.main = async (event, context) => {
    console.log("Hello World");
    console.log("Event:", event);
    console.log("Context:", context);
    try {
        // 获取所有用户的 session 并并发处理
        const signIn = await db.collection('token').get()
            .then((response) => {
                const users = response.data;

                // 使用 map 并且确保异步操作正确处理
                const promises = users.map(async (user) => {
                    // const { session, is_active } = user;
                    const session = JSON.parse(user.session);
                    if (user.is_active) {
                        return checkCourseList(user._id, session);
                    }
                    return [`用户${user._id}已禁用`];
                });

                // 等待所有并发操作完成并返回结果
                return Promise.all(promises);
            });

        // 处理完所有用户后，返回课程列表
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: "签到完成",
                details: signIn,
            }),
        };
    } catch (error) {
        console.error("处理过程中出现错误:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: "处理过程中出现错误",
                error: error.message,
            }),
        };
    }
};
