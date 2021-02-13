## Verdant_Search Standard

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