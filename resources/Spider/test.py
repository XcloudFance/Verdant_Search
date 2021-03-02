import requests
hea = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3",
    "Accept-Encoding": "gzip, deflate",
    "Accept-Language": "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7",
    "Cache-Control": "no-cache",
    "Connection": "close",
    "Cookie": "AspxAutoDetectCookieSupport=1",
    # "Host": "jyj.quanzhou.gov.cn",
    "Pragma": "no-cache",
    
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/75.0.3770.100 Safari/537.36",
}

url = 'https://blog.csdn.net/weixin_42066185/article/details/81675726'
result = requests.get(url,hea).text
# 拿到重定向后的url
print(result)