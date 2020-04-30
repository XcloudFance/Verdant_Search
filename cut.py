import jieba
def Cut(content):
       return list(jieba.cut_for_search(content))
#这个地方用来修改Cut函数的切割内容，后期如果使用自行机器学习的分割算法可以直接带进来修改，此处用作方便修改分词
