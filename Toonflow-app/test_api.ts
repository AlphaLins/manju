import axios from 'axios';

// 简单测试请求
async function test() {
    const apiKey = "sk-xxxxxxxx"; // 用户刚才配置的测试Key
    const baseURL = "https://sunnyapi.apifox.cn"; // 用户可能填入的地址

    try {
        const res = await axios.post(
            `https://api.openai.com/v1/chat/completions`, // 使用默认或是 SunnyAPI 的兼容地址
            {
                model: "gpt-3.5-turbo",
                messages: [{ role: "user", content: "请给出北京今天的天气，并返回 JSON 格式" }]
            },
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Accept': 'application/json'
                }
            }
        );
        console.log("Success:", res.data);
    } catch (e: any) {
        console.log("Axios Error:", e.response ? e.response.data : e.message);
    }
}

test();
