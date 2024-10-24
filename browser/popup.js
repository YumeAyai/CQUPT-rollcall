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
            console.log("zworking!");
            var temp = response.json();
            return temp;
          })
          .then(function (options) {
            var optionSelect = document.getElementById("optionSelect");
            options["rollcalls"].forEach(function (option) {
              var optionElement = document.createElement("option");
              console.log(option["course_title"]);
              optionElement.value = JSON.stringify(option);
              optionElement.textContent = option["course_title"];
              optionSelect.appendChild(optionElement);
            });
            if (options["rollcalls"] == "") {
              var optionElement = document.createElement("option");
              optionElement.value = "NULL";
              optionElement.textContent = "No course roll call is conducted";
              optionSelect.appendChild(optionElement);
            }
          })
          .catch(function (error) {
            window.open("http://lms.tc.cqupt.edu.cn/user/index#/", "_blank");
            console.error("Error:", error);
          });
      } else {
        window.open("http://lms.tc.cqupt.edu.cn", "_blank");
      }
    },
  );
}

function signIn() {
  console.log("f!!!!");
  const deviceId = crypto.randomUUID();
  chrome.cookies.get(
    { url: "http://lms.tc.cqupt.edu.cn", name: "session" },
    function (cookie) {
      if (cookie) {
        var session = cookie.value;
        var headers = new Headers();
        headers.append("x-session-id", session);
        if (document.getElementById("optionSelect").value == "NULL") {
          var Container = document.getElementById("Container");
          Container.innerHTML = "<h2>No Course is rollcalling</h2>";
        } else {
          var selectedOption = JSON.parse(
            document.getElementById("optionSelect").value,
          );
          var textApiUrl = "http://lms.tc.cqupt.edu.cn/api/course/" +
            selectedOption["course_id"] + "/rollcall/" +
            selectedOption["rollcall_id"] + "/qr_code";
          fetch(textApiUrl, { headers: headers })
            .then(function (response) {
              return response.json().then(function (text) {
                const token = response.headers.get("x-session-id");
                return { text, token }; // 封装成对象返回
              });
            })
            .then(function ({ text, token }) {
              var putUrl = "http://lms.tc.cqupt.edu.cn/api/rollcall/" +
                selectedOption["rollcall_id"] + "/answer_qr_rollcall";
              fetch(putUrl, {
                headers: {
                  "X-SESSION-ID": token,
                  "Content-Type": "application/json",
                  "User-Agent":
                    "Mozilla/5.0 (Linux; Android 14; PGU110 Build/UKQ1.230924.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/109.0.5414.86 MQQBrowser/6.2 TBS/046913 Mobile Safari/537.36 wxwork/4.1.20 MicroMessenger/7.0.1 NetType/4G Language/zh Lang/zh ColorScheme/Dark",
                  "Accept": "application/json, text/plain, */*",
                  "Accept-Encoding": "gzip, deflate",
                  "X-Requested-With": "XMLHttpRequest",
                  "Accept-Language": "zh-Hans",
                  "Origin": "http://mobile.tc.cqupt.edu.cn",
                  "Referer": "http://mobile.tc.cqupt.edu.cn/",
                },
                method: "PUT",
                body: JSON.stringify({
                  "data": text,
                  "deviceId": deviceId,
                }),
              })
                .then(function (response) {
                  if (response.ok) {
                    var Container = document.getElementById("Container");
                    Container.innerHTML = "<h2>Suceess</h2>";
                    console.log("success");
                  } else {
                    var Container = document.getElementById("Container");
                    Container.innerHTML = "<h2>Fail</h2>";
                    console.log("fail");
                  }
                });
            })
            .catch(function (error) {
              var Container = document.getElementById("Container");
              Container.innerHTML = "<h2>Error</h2>";
              console.error("Error:", error);
            });
        }
      }
    },
  );
}
