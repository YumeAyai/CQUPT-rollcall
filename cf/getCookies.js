// cookies太短不推荐使用,除非你服务一直不关

'use strict';
const axios = require('axios');
const cloudbase = require('@cloudbase/node-sdk');
const app = cloudbase.init({});
var db = app.database();
const qs = require('qs');

async function getSessionCookie(username, password) {
    try {
        // Step 1: 访问 LMS 并跟踪重定向到 SSO 登录页面
        let response = await axios.get("http://lms.tc.cqupt.edu.cn/", {
            maxRedirects: 0,
            validateStatus: (status) => status >= 200 && status < 400,
        });
        const initialCookies = response.headers["set-cookie"].join("; ");

        // Step 2: 模拟登录请求
        const loginData = {
            username: username,
            password: password,
            //   lt: extractLT(response.data), // 提取 lt 参数
            //   execution: "e1s1", // 假设该值为固定
            _eventId: "submit",
        };

        // 向登录页面提交表单
        response = await axios.post(
            "https://ids.cqupt.edu.cn/authserver/login",
            qs.stringify(loginData),
            {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Cookie": initialCookies,
                },
                maxRedirects: 0,
                validateStatus: (status) => status >= 200 && status < 400,
            },
        );

        // Step 3: 重定向回来，获取 Cookie
        if (response.status === 302) {
            const redirectUrl = response.headers.location;
            response = await axios.get(redirectUrl, {
                headers: {
                    "Cookie": response.headers["set-cookie"].join("; "),
                },
            });
        }
        return initialCookies
    } catch (error) {
        // 打印详细的错误信息
        console.error("Error during login:", error);
        console.error(
            "Error response data:",
            error.response ? error.response.data : null,
        );
        throw error;
    }
}

function extractLT(html) {
    // 假设从 HTML 中提取隐藏字段 lt
    const regex = /name="lt" value="(.*?)"/;
    const match = html.match(regex);
    return match ? match[1] : null;
}

exports.main = async (event, context) => {
    try {
        const response = await db.collection('token').get();
        const users = response.data;

        const promises = users.map(async (user) => {
            try {
                const cookieHeader = await getSessionCookie(user._id, user.password);
                await db.collection('token')
                    .doc(user._id)
                    .update({
                        session: JSON.stringify({ "Cookie": cookieHeader })
                    });
                console.log("Session updated for user:", user._id);
            } catch (error) {
                console.error("Error updating session for user:", user._id, error);
            }
        });

        await Promise.all(promises);

        return {
            message: "Session updated for all users."
        };
    } catch (error) {
        console.error("Error:", error);
        return {
            message: "An error occurred.",
            error: error.message
        };
    }
};
