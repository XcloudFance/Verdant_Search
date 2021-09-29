##   Verdant_Search Standard

#### Description

这里用来存放搜索引擎与爬虫对数据库的加分制，以便参考

> ##### 版本: 0.2

##### profession.json

这个json存放**特定网址**的**直接加分**，爬虫爬取过程中遇到完全一致的网址就会直接对结果进行加分

##### weigh.json

如果域名直接出现json内的key值，那么对应的value值就会被相应增加



假设weigh.json为

```json
{

"bilibili":10,

".com":20

}
```

那么http://bilibili.com这个uri就是直接加30分



> ##### 1.0之前的版本以上两个json仍然保存

##### 插入日志的sql

type: search

content：放关键词



##### 返回每日的搜索频率

返回当日该关键词被搜索的次数

返回当日该关键词什么时候被搜索



##### 日志系统

###### 获取今天某个关键词的搜索数据

POST /get_today_data 

request:
```json
{"keyword":["关键词1","关键词2"]}
```

response:
```json
{
    "Code":200,
    "Data":[
        [
            ["2000/10/04",226],
            ["2000/10/05",326]
        ],
        [
            ["2000/10/04",321],
            ["2000/10/05",544]
        ]
    ]
}
```

##### 插件系统

原先服务器返回的搜索应该是这样的：

```json
{

    1:{

        "type":"translation",

        "url":"xxx"

    }

}
```

type: translation/extension

如果是translation就是翻译

extension就是插件

下面是extension的例子

```json
{
    1:{
        "type":"extension",
        "url":"xxx",
        "extension_url":"xxx",
        "title":"xxx",
        "htmlcode":"xxx",
        "height":280
    }
}
```

