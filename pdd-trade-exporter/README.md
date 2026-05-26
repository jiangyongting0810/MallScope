# 拼多多交易数据导出助手

这是一个 Chrome Manifest V3 插件，用来把拼多多商家后台“交易数据”页中的当前交易指标导出为 CSV。

## 目录说明

- `manifest.json`：插件清单和权限配置。
- `popup.html` / `popup.js` / `popup.css`：弹窗界面、状态提示和导出流程。
- `content.js`：页面校验、扩展侧消息接收、数据快照管理。
- `page-main.js`：运行在 `MAIN` world 的页面请求监听脚本。
- `samples/`：开发时保留的本地 HTML、HAR、导出样本。

## 当前行为

1. 只在 `https://mms.pinduoduo.com/sycm/stores_data/operation*` 页面运行。
2. 页面刷新后，监听 `queryMallTradeList` 接口响应。
3. 从 `result.todayRtList` 中取最新一条，提取 `payOrdrAmt` 和 `payOrdrCnt`。
4. 导出单行 CSV，包含采集时间、页面地址、成交金额、成交订单数。

## 已知限制

- 这一版依赖页面自己先发出交易接口请求。
- 正确使用顺序是：打开目标页、刷新页面、等待数据出现、再点击导出。

## 本地加载

1. 打开 `chrome://extensions/`。
2. 开启“开发者模式”。
3. 点击“加载已解压的扩展程序”。
4. 选择当前 `pdd-trade-exporter` 目录。
