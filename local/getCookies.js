const puppeteer = require("puppeteer");
const fs = require("fs");

async function getSessionCookie(username, password) {
  const browser = await puppeteer.launch({ headless: true }); // 设置为 false 以查看浏览器操作
  // const page = await browser.newPage();
  const [page] = await browser.pages();

  // 导航到登录页面
  await page.goto("http://lms.tc.cqupt.edu.cn/");

  // 填写登录表单
  await page.type("#username", username);
  await page.type("#password", password);

  await page.click("#login_submit");

  // 等待导航完成
  await page.waitForNavigation();

  // 获取 Cookies
  const cookies = await page.cookies();

  // 关闭浏览器
  await browser.close();

  return cookies;
}

// 使用示例
getSessionCookie("167xxxx", "password")
  .then((cookies) => {
    const cookieHeader = cookies.map((cookie) => {
      return `${cookie.name}=${cookie.value}; Path=${cookie.path}`;
    }).join("; ");

    const headers = {
      "Cookie": cookieHeader,
    };

    fs.writeFileSync("header.json", JSON.stringify(headers, null, 2));
  })
  .catch((error) => {
    console.error("Error:", error);
  });

module.exports = { getSessionCookie };
