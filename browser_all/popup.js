document.addEventListener("DOMContentLoaded", function () {
  loadOptions();
  var generateButton = document.getElementById("generateButton");
  generateButton.addEventListener("click", function () {
    signIn();
  });
});

function loadOptions() {
  chrome.cookies.get(
    { url: "http://lms.tc.cqupt.edu.cn", name: "session" },
    function (cookie) {
      if (cookie) {
        var session = cookie.value;
        var headers = new Headers();
        headers.append("Cookie", "session=" + session);
        var optionsUrl =
          "http://lms.tc.cqupt.edu.cn/api/radar/rollcalls?api_version=1.1.0";
        fetch(optionsUrl, { headers: headers })
          .then(function (response) {
            if (!response.ok) throw new Error("网络请求失败");
            return response.json();
          })
          .then(function (options) {
            var optionSelect = document.getElementById("optionSelect");
            optionSelect.innerHTML = ""; // 清空之前的选项
            if (options["rollcalls"].length === 0) {
              var optionElement = document.createElement("option");
              optionElement.value = "NULL";
              optionElement.textContent = "No course roll call is conducted";
              optionSelect.appendChild(optionElement);
            } else {
              options["rollcalls"].forEach(function (option) {
                var optionElement = document.createElement("option");
                optionElement.value = JSON.stringify(option);
                optionElement.textContent = option["course_title"];
                optionSelect.appendChild(optionElement);
              });
            }
          })
          .catch(function (error) {
            window.open("http://lms.tc.cqupt.edu.cn/user/index#/", "_blank");
            console.error("Error:", error);
            displayMessage("Error loading courses. Please login to LMS.", "error");
          });
      } else {
        displayMessage("Please login to LMS.", "error");
        window.open("http://lms.tc.cqupt.edu.cn", "_blank");
      }
    },
  );
}

function signIn() {
  const deviceId = crypto.randomUUID();
  chrome.cookies.get(
    { url: "http://lms.tc.cqupt.edu.cn", name: "session" },
    function (cookie) {
      if (cookie) {
        var session = cookie.value;
        var headers = new Headers();
        headers.append("x-session-id", session);
        var selectedOption = document.getElementById("optionSelect").value;
        if (selectedOption === "NULL") {
          displayMessage("No Course is currently conducting roll calls.", "info");
        } else {
          var option = JSON.parse(selectedOption);
          if (option["source"] === "number") {
            numericSignIn(option["rollcall_id"], session);
          } else {
            qrCodeSignIn(option["course_id"], option["rollcall_id"], session);
          }
        }
      } else {
        displayMessage("Session expired. Please login again.", "error");
        window.open("http://lms.tc.cqupt.edu.cn", "_blank");
      }
    },
  );
}

function numericSignIn(rollcallId, session) {
  const statusUrl =
    `http://lms.tc.cqupt.edu.cn/api/courses/rollcall_status/${rollcallId}/result`;

  fetch(statusUrl, {
    method: "GET",
    headers: {
      "x-session-id": session,
      "User-Agent":
        "Mozilla/5.0 (Linux; Android 14; PGU110 Build/UKQ1.230924.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/109.0.5414.86 MQQBrowser/6.2 TBS/046913 Mobile Safari/537.36 wxwork/4.1.20 MicroMessenger/7.0.1 NetType/4G Language/zh Lang/zh ColorScheme/Light",
      "Accept": "application/json, text/plain",
      "Content-Type": "application/json",
    },
  })
    .then((response) => {
      if (!response.ok) throw new Error("获取数字签到码失败");
      return response.json();
    })
    .then((data) => {
      const numberCode = data.number_code;
      const signInUrl =
        `http://lms.tc.cqupt.edu.cn/api/rollcall/${rollcallId}/answer_number_rollcall`;
      const body = JSON.stringify({ numberCode });

      return fetch(signInUrl, {
        method: "PUT",
        headers: {
          "x-session-id": session,
          "Content-Type": "application/json",
        },
        body: body,
      });
    })
    .then((response) => {
      if (!response.ok) throw new Error("签到失败");
      return response.json();
    })
    .then((result) => {
      console.log("数字签到结果:", result);
      displayMessage("Numeric sign-in successful!", "success");
    })
    .catch((error) => {
      console.error("数字签到出错:", error);
      displayMessage("Numeric sign-in failed. Please try again.", "error");
    });
}

function qrCodeSignIn(courseId, rollcallId, session) {
  const qrCodeUrl =
    `http://lms.tc.cqupt.edu.cn/api/course/${courseId}/rollcall/${rollcallId}/qr_code`;

  fetch(qrCodeUrl, {
    method: "GET",
    headers: {
      "x-session-id": session,
      "User-Agent":
        "Mozilla/5.0 (Linux; Android 14; PGU110 Build/UKQ1.230924.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/109.0.5414.86 MQQBrowser/6.2 TBS/046913 Mobile Safari/537.36 wxwork/4.1.20 MicroMessenger/7.0.1 NetType/4G Language/zh Lang/zh ColorScheme/Light",
      "Accept": "application/json, text/plain",
      "Content-Type": "application/json",
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
      const signInUrl =
        `http://lms.tc.cqupt.edu.cn/api/rollcall/${rollcallId}/answer_qr_rollcall`;
      const body = JSON.stringify({
        data: qrCodeData.data,
        deviceId: deviceId,
      });

      return fetch(signInUrl, {
        method: "PUT",
        headers: {
          "x-session-id": session,
          "Content-Type": "application/json",
        },
        body: body,
      });
    })
    .then((response) => {
      if (!response.ok) throw new Error("二维码签到提交失败");
      return response.json();
    })
    .then((result) => {
      console.log("二维码签到结果:", result);
      displayMessage("QR code sign-in successful!", "success");
    })
    .catch((error) => {
      console.error("二维码签到出错:", error);
      displayMessage("QR code sign-in failed. Please try again.", "error");
    });
}

function displayMessage(message, type) {
  const container = document.getElementById("Container");
  container.innerHTML = `<h2>${message}</h2>`;
  const colorMap = {
    success: "green",
    error: "red",
    info: "blue",
    default: "black"
  };
  container.style.color = colorMap[type] || colorMap.default;
}

