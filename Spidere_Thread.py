# -*- coding:utf-8 -*-
import os
import sys
import urllib
import urllib.parse
import urllib.request
import re
from bs4 import BeautifulSoup
import jsonpage
import threadpool
from threading import Thread
import time
headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:66.0) Gecko/20100101 Firefox/66.0'}
dictlist = {}
geturl = []
def togbk(string):
	return string.encode('gbk')


def delcssjs(code):
	while (code.find("<style>") != -1):
		code = code[code.find("<style>") + len("<style>"):code.find("</style>")]
	while (code.find("<script>") != -1):
		code = code[code.find("<script>") + len("<script>"):code.find("</script>")]
	while code.find('<script type="text/javascript">') != -1:
		code = code[code.find('<script type="text/javascript">') + len('<script type="text/javascript">'):code.find(
			"</script>")]
	return code


def gethtmurl(url):
	soup = BeautifulSoup(url, "html.parser")
	ret = []
	href_ = soup.find_all(name='a')
	for each in href_:
		if str(each.get('href'))[:4] == 'http':
			ret.append(each.get('href'))
	return ret


def get_content(url):
	bs = BeautifulSoup(url, 'html.parser')
	[s.extract() for s in bs(['script', 'style'])]
	return bs.get_text().replace('\n', '').replace('\xa0', '')




def t1(urler):
	global geturl
	global headers
	global dictlist
	try:
		print(urler)
		req = urllib.request.Request(url=urler, headers=headers)
		if (urler in dictlist):
			return #continue
		if (urler.find('.png') != -1):
			return #continue
		code = urllib.request.urlopen(req).read()
		geturls = gethtmurl(code)
		tmpcode = code
		count = 0
		while 1 and count <= 100:
			count += 1
			tmpcode = get_content(tmpcode)  # .replace("\xa1","").replace('\u02d3',"").replace('\u0632',"")
			if (code != tmpcode):
				code = tmpcode
			else:
				break
		dictlist[urler] = code  # get_content(str(code.decode('utf-8',"ignore"))).replace("\xa1","").replace('\u02d3',"").replace('\u0632',"")
		geturl += geturls
		print(geturl)
	except:
		print(urler + " :error")
	try:
		print(dictlist)
	except:
		print("编码错误")
		dictlist.pop(urler)
def mainly():
	threadpool.ThreadPool(3)
	global geturl
	url = "http://www.baidu.com"
	geturl = [url]
	length = 0
	while geturl != []:
		tmplist = geturl
		geturl = []
		for i in tmplist:
			Thread(target = t1,args=[i]).start()
			time.sleep(5)

def test():
	print(jsonpage.js001)


if (__name__ == "__main__"):
	test()
	mainly()

