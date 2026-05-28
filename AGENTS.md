# MallScope 项目操作规则

## 文件删除安全约束

禁止批量删除文件或目录。

不要使用以下命令：

- `del /s`
- `rd /s`
- `rmdir /s`
- `Remove-Item -Recurse`
- `rm -rf`

需要删除文件时，只能一次删除一个明确路径的文件。

正确示例：

```powershell
Remove-Item "C:\path\to\file.txt"
```

如果需要批量删除文件，应停止操作，并请求用户手动删除。

## 插件上下文

插件目录：`C:\Users\Administrator\Documents\MallScope\pdd-trade-exporter`

关键文件：

- `pdd-trade-exporter\manifest.json`：Chrome MV3 配置和注入目标。
- `pdd-trade-exporter\page-main.js`：在页面主世界拦截 `fetch`/`XMLHttpRequest` 响应并转发目标 API 数据。
- `pdd-trade-exporter\content.js`：识别页面、缓存接口快照、映射字段、处理数字解码和导出数据。
- `pdd-trade-exporter\popup.js`：弹窗按钮、标签页检查、汇总导出 CSV。
- `pdd-trade-exporter\popup.html` / `popup.css`：弹窗 UI。
- `pdd-trade-exporter\verify-sample.js`：本地样例回放验证。

## 目标页面和 API

- 交易数据页：`https://mms.pinduoduo.com/sycm/stores_data/operation*`
- 商品数据页：`https://mms.pinduoduo.com/sycm/goods_effect*`
- 推广数据页：`https://yingxiao.pinduoduo.com/goods/promotion/list*`
- 交易趋势 API：`/api/mallTrade/queryMallTradeList`
- 交易概览 API：`/api/mallTrade/getMallTradeInfo`
- 商品概览 API：`/sydney/api/goodsDataShow/queryGoodsPageOverviewForMms`
- 推广日报 API：`/mms-gateway/poseidon/api/report/queryHourlyRangeReport`
- 推广数据位置：`result.dailyReport`

## 字段映射

交易页字段：

- 成交金额：`payOrdrAmt`
- 成交订单数：`payOrdrCnt`
- 客单价：`payOrdrAup`
- 访客价值：优先用 `payOrdrAmt / (payOrdrUsrCnt / payUvRto)` 计算；必要时从 `uvCfmVal` 或 DOM 兜底。
- 成交转化率：`payUvRto`

商品页字段：

- 商品访客数：优先 `guv`，兼容 `uv`、`goodsUv`、`visitorCnt`、`visitorCount`、`goodsVisitorCnt`、`goodsVisitorCount`。
- 商品浏览量：优先 `gpv`，兼容 `goodsGpv`、`viewCnt`、`viewCount`、`goodsViewCnt`、`goodsViewCount`。

推广页字段：

- 成交营销花费(元)：`orderMarketingSpend`
- 净交易额(元)：`netGmv`
- 实际投产比：`orderSpendRoiUnified`
- 实际净投产比：`orderSpendNetRoi`
- 净成交笔数：优先 `orderSpendNetOrderNum`、`orderSpendNetOrderCount`、`netOrderNum`、`netOrderCount`；如果接口没有直接字段，则用 `orderMarketingSpend / orderSpendNetCostPerOrder` 反推。
- 每笔净成交花费(元)：`orderSpendNetCostPerOrder`
- 曝光量：`impression`
- 点击量：`click`
- 点击转化率：`cvr`

不要把 `orderNum` 当作净成交笔数。已发现真实页面会出现 `orderNum = 5` 但净成交笔数为 `4` 的情况；此时 `105 / 26.25 = 4`。

## 当前导出格式

弹窗只有一个导出按钮：`导出昨日数据`。

导出 CSV 是一行昨日数据，横向合并两个表：

```text
数据日期, 成交金额, 成交订单数, 客单价, 访客价值, 成交转化率, 商品访客数, 商品浏览量, 成交营销花费(元), 实际投产比, 广告费率, 空列, 推广数据, 数据日期, 成交营销花费(元), 净交易额(元), 实际投产比, 净成交笔数, 每笔净成交花费(元), 曝光量, 点击量, 点击转化率
```

广告费率计算：`成交营销花费(元) / 成交金额 * 100%`。

日期显示：用采集时间减一天，格式为 `MM-DD`。

## 验证命令

改动后至少运行：

```powershell
node --check C:\Users\Administrator\Documents\MallScope\pdd-trade-exporter\popup.js
node --check C:\Users\Administrator\Documents\MallScope\pdd-trade-exporter\content.js
node --check C:\Users\Administrator\Documents\MallScope\pdd-trade-exporter\page-main.js
node C:\Users\Administrator\Documents\MallScope\pdd-trade-exporter\verify-sample.js
git diff --check
git status --short --branch
```

如修改弹窗 UI，建议在 Chrome 扩展页重新加载插件，并人工确认 `打开三个页面`、`刷新三个页面`、`导出昨日数据` 三个按钮可用。
