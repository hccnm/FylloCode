## 1. TaskDetailModal 状态展示与编辑

- [x] 1.1 查看模式中新增任务状态展示（UBadge，open=success/closed=neutral）
- [x] 1.2 编辑模式中新增状态编辑（URadioGroup，水平排列，选项为打开/关闭）
- [x] 1.3 编辑模式初始化时从 task.status 预填状态值
- [x] 1.4 保存时在 payload 中提交 status 字段

## 2. 保存反馈与弹窗关闭

- [x] 2.1 在 task.vue 的 handleSaveDetail 中，保存成功后展示 toast「保存成功」
- [x] 2.2 toast 展示后关闭弹窗

## 3. 测试同步

- [x] 3.1 更新 task-detail-modal.spec.ts 中 save payload 断言，补充 status 字段
- [x] 3.2 新增查看模式展示状态的测试用例
- [x] 3.3 新增编辑模式预填状态的测试用例
