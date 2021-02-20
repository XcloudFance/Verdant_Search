'''
测试一下selenium对百度的爬虫
'''
from selenium import webdriver
from bs4 import  BeautifulSoup
from CubeQL_Client import CubeQL
chrome_options = webdriver.ChromeOptions()
prefs={"profile.managed_default_content_settings.images":2}
chrome_options.add_experimental_option("prefs",prefs)
def mijisou(keyword):
    driver = webdriver.Chrome(chrome_options=chrome_options)
    driver.get(r'https://blog.csdn.net/weixin_42066185/article/details/81675726')
    #可能需要等待js加载完毕

    print(driver.page_source)
            
''' 
秘迹搜有两个标签特点
第一个是result-header,a标签的href是网址，内容是标题，带有高亮标签
第二个是result-content, 内容有高亮标签，内容也是简介，可以直接存进database
'''