import requests
url = 'http://sogou.com/link?url=LeoKdSZoUyDAr6Ild5QHpKxN0Zt5tnto58S8aCoD7vNw8wp9KypZA56u7V7d43mT5ZdXx8FLePA.'
result = requests.get(url,allow_redirects=True)
# 拿到重定向后的url
print(result.text)