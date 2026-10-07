/**
 * 去趣 ChicTrip eSIM 使用者意見調查 — Google Apps Script
 *
 * 使用方式：
 *  1. 開啟 https://script.google.com → 新增專案
 *  2. 把本檔案全部內容貼進編輯器，取代預設的 Code.gs
 *  3. 執行 createChictripSurvey() 一次（首次會要求授權 Google Drive & Forms）
 *  4. 執行後「執行紀錄」會印出表單的「編輯網址」與「填寫網址」
 */

function createChictripSurvey() {
  var form = FormApp.create('去趣 ChicTrip eSIM 使用者意見調查')
    .setDescription(
      '這份問卷目的在了解消費者「為什麼」選擇使用「去趣 ChicTrip」的 eSIM 方案，\n' +
      '以及您在購買、安裝、使用過程中的體驗與建議。\n' +
      '預計填答時間約 2 分鐘，所有回覆皆為匿名，僅作為研究與產品改進使用，感謝您的協助！'
    )
    .setCollectEmail(false)
    .setAllowResponseEdits(false)
    .setShowLinkToRespondAgain(false)
    .setProgressBar(true);

  // Q1 是否使用過去趣 eSIM（分流題）
  form.addMultipleChoiceItem()
    .setTitle('1. 您是否曾使用過「去趣 ChicTrip」的 eSIM 方案？')
    .setChoiceValues(['使用過', '聽過但沒買過', '沒聽過'])
    .setRequired(true);

  // Q2 購買過哪些地區的方案
  form.addCheckboxItem()
    .setTitle('2. 您曾向「去趣」購買過哪些地區的 eSIM 方案？（若未購買過請略過）')
    .setChoiceValues([
      '日本',
      '韓國',
      '中港澳 / 中國',
      '新加坡 / 馬來西亞',
      '越南',
      '菲律賓',
      '泰國',
      '歐洲',
      '澳洲 / 紐西蘭',
      '美國 / 加拿大',
      '其他'
    ])
    .showOtherOption(true)
    .setRequired(false);

  // Q3 ★核心：為什麼選擇去趣
  form.addCheckboxItem()
    .setTitle('3. 您選擇「去趣」而不是其他 eSIM 品牌（如 Airalo、Holafly 等）的主要原因？')
    .setHelpText('可複選')
    .setChoiceValues([
      '價格便宜 / CP 值高',
      '方案種類多、天數選擇彈性',
      '中文介面、中文客服',
      '台灣廠商、信任感高',
      '網路評價與開箱文多',
      '有折扣碼或促銷活動',
      'LINE 客服回應快',
      '朋友或旅遊社團推薦',
      '結帳與付款方式方便（支援台灣常用金流）',
      '網路速度與穩定度口碑好'
    ])
    .setRequired(false);

  // Q4 購買時最在意的因素
  form.addMultipleChoiceItem()
    .setTitle('4. 購買 eSIM 方案時，您最在意的「單一」因素是？')
    .setChoiceValues([
      '價格',
      '流量大小 / 是否吃到飽',
      '網路速度與穩定度',
      '天數彈性',
      '客服與售後',
      '品牌信任感',
      '安裝與開通方便程度'
    ])
    .setRequired(true);

  // Q5 安裝體驗
  form.addScaleItem()
    .setTitle('5. 去趣 eSIM 的「安裝 / 開通」順利程度？')
    .setBounds(1, 5)
    .setLabels('非常不順利', '非常順利')
    .setRequired(false);

  // Q6 網路體驗
  form.addScaleItem()
    .setTitle('6. 去趣 eSIM 的「網路速度與穩定度」滿意度？')
    .setBounds(1, 5)
    .setLabels('非常不滿意', '非常滿意')
    .setRequired(false);

  // Q7 遇過的問題
  form.addCheckboxItem()
    .setTitle('7. 使用去趣 eSIM 時曾遇到的問題？（若無請選「都沒遇到」）')
    .setChoiceValues([
      'QR Code 安裝失敗',
      '落地後無法連線',
      '網速比預期慢',
      '訊號不穩或斷線',
      '流量用超額、加購不便',
      '客服回應慢或找不到人',
      '方案描述與實際不符',
      '結帳 / 付款出問題',
      '都沒遇到'
    ])
    .setRequired(false);

  // Q8 NPS 推薦意願
  form.addScaleItem()
    .setTitle('8. 您有多願意把「去趣 ChicTrip」推薦給親友？')
    .setBounds(0, 10)
    .setLabels('完全不會', '非常願意')
    .setRequired(true);

  // Q9 下次是否會再買
  form.addMultipleChoiceItem()
    .setTitle('9. 下次出國，您會再選擇「去趣」嗎？')
    .setChoiceValues([
      '一定會',
      '很可能會',
      '會再比較其他家',
      '應該不會',
      '一定不會'
    ])
    .setRequired(true);

  // Q10 開放題
  form.addParagraphTextItem()
    .setTitle('10. 您希望「去趣」未來改進或新增哪些功能 / 服務？（可略過）')
    .setRequired(false);

  var editUrl = form.getEditUrl();
  var publishedUrl = form.getPublishedUrl();
  Logger.log('✅ 問卷建立完成');
  Logger.log('📝 編輯網址：' + editUrl);
  Logger.log('🔗 填寫網址：' + publishedUrl);
  return { edit: editUrl, published: publishedUrl };
}
