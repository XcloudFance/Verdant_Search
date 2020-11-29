'''
测试一下selenium对百度的爬虫
'''
from selenium import webdriver
from bs4 import  BeautifulSoup
from CubeQL_Client import CubeQL
def mijisou(keyword):
    driver = webdriver.Chrome()
    driver.get(r'https://mijisou.com/?q='+keyword+'&category_general=on&time_range=&language=zh-CN&pageno=1')
    #可能需要等待js加载完毕

    soup = BeautifulSoup(driver.page_source, "html.parser")
    href_ = soup.find_all(name="h4")
    for each in href_:
            # print(each.get('rel'))
            if each.get("class") == ['result_header']:#["noopener", "noreferrer"]:
                
                if each.a.get('href').find('mijisou')!=-1:
                    #如果发现是proxy网页不能直接进去，就不要了
                    continue
                print(each.a.get('href'))
                print(each.text)
                cube = CubeQL()
                cube.set(each.a.get('href'),'fromsearch')
            
''' 
秘迹搜有两个标签特点
第一个是result-header,a标签的href是网址，内容是标题，带有高亮标签
第二个是result-content, 内容有高亮标签，内容也是简介，可以直接存进database
这个是青荇搜索自我学习爬虫的一部分功能，对其他搜索引擎进行爬虫
青荇搜索还可以通过不同领域进行不同结果的展示
- 英文文献页面 并且支持文本翻译后打开
- IT页面，支持对计算机方面(github,csdn,stackoverflow等网站)customed Spider(定制化爬虫)

Customed Distributed Spider 定制化分布式爬虫
- 英语词典爬虫
- 综合搜索引擎爬虫
- 不同领域不同网页的定制爬虫
'''
