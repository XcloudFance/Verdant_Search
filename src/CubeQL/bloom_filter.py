from pybloom_live import ScalableBloomFilter, BloomFilter

# 可自动扩容的布隆过滤器
bloom = ScalableBloomFilter(initial_capacity=100)

url1 = 'http://www.baidu.com'
url2 = 'http://qq.com'



print(url1 in bloom)
print(url2 in bloom)