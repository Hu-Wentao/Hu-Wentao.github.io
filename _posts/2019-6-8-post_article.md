---
layout: post
title: 发布文章的步骤
date: 2019-6-8
tags: 博客   
---

　如何编写文章, 并发布文章到网页?


### 编写文章

　　所有的文章都是 _posts 目录下面，文章格式为 mardown 格式，文章文件名可以是 .mardown 或者 .md。

　　编写一篇新文章很简单，直接从 _posts/ 目录下复制 `2019-6-8-post_article.md` ，修改名字为 2019-6-8-my_article.md ，注意：文章名的格式前面必须为 2016-6-8- ，日期可以修改，但必须为 年-月-日- 格式，后面的 article1 是整个文章的连接 URL，文章名最好是英文的或者阿拉伯数字。
```text

---
layout: post
title: 发布文章的步骤
date: 2019-6-8
tags: 博客   
---

正文...

```


title: 显示的文章名， 如：title: 发布文章的步骤                 
date:  显示的文章发布日期，如：date: 2019-6-8                
tag: tag标签的分类，如：tag: 随笔            

注意：文章头部格式必须为上面的，.... 就是文章的正文内容。

我使用的编辑器是 VS Code，如果你对 markdown 语法不熟悉的话，可以看看[作业部落的教程](https://www.zybuluo.com/) 

#### 添加图片
* 示例
![](/images/posts/article/test.jpg)
```text

* 示例
![](/images/posts/article/test.jpg)

```

### 发布文章

>* 将编写好的 *.md 文件上传到仓库中的 /_posts/ 目录下
>* 如果文章包含图片, 请将图片放入 /images/posts/{你的文章名称}/    目录下









