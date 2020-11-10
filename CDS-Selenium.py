'''
测试一下selenium对百度的爬虫
'''
from selenium import webdriver
driver = webdriver.Chrome()
page = driver.get('https://www.baidu.com/')
#可能需要等待js加载完毕
print(page.text)