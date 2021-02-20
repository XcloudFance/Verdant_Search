# -*- coding:utf-8 -*-
# encoding:utf-8
# 此版本为CDS(Custom Distrbuted Spider)版本，支持一键直接爬虫
# 用redis+mysql实现
import os
import sys
import urllib
import urllib.parse
import urllib.request
import requests
import re
from bs4 import BeautifulSoup
from cut import *
import pymysql
import socket, socketserver
import threading
import demjson
import json
import random
import redis
import CubeQL_Client
import threading
import psycopg2
from CDS_Selenium import *
import time


def get_url(url):
    soup = BeautifulSoup(url, "html.parser")
    ret = []
    href_ = soup.find_all(name="a")
    for each in href_:
        if str(each.get("href"))[:4] == "http":
            ret.append(each.get("href"))
    return ret

def catch_bing_search(word):
    driver = webdriver.Chrome(chrome_options=chrome_options)
    driver.get(r'https://cn.bing.com/search?q='+word)
    return list(set(get_url(driver.page_source))))
    pass

if __name__ == '__main__':
    catch_bing_search('aa')