# Property Panel UI 重构计划

## 背景

当前属性面板的 UI 实现与设计稿 `attr-ui.html` 存在较大差异。本文档详细规划了重构任务，按照优先级从高到低排列，目标是让属性面板的视觉效果和交互体验与设计稿一致。

### 参考文件

- **设计稿**：`/attr-ui.html`
- **当前样式**：`ui/shadow-host.ts`
- **面板结构**：`ui/property-panel/property-panel.ts`
- **控件组件**：`ui/property-panel/controls/*.ts`

---

## 前置任务（已完成）

### 0.1 最小化 Bug 修复 ✅

**问题**：toolbar 和属性面板最小化时，只是背景消失了，里面的内容实际上还在

**根因**：CSS 中 `display: flex/inline-flex` 覆盖了 `[hidden]` 属性的默认 `display: none`

**解决方案**：

- [x] 在 `shadow-host.ts` 末尾添加全局 `[hidden] { display: none !important; }` 规则

### 0.2 输入框优化 ✅

**问题**：

1. 输入框显示 placeholder 而非真实值
2. Number 类型输入框不支持键盘上下键调整

**解决方案**：

- [x] 创建 `ui/property-panel/controls/number-stepping.ts` 工具模块
  - 支持 ArrowUp/ArrowDown 键盘步进
  - 支持 Shift (10x)、Alt (0.1x) 修饰键
  - 支持多种 CSS 单位 (px, %, rem, em, vh, vw, vmin, vmax)
- [x] 修改所有 control 显示真实值（inline 优先，fallback 到 computed）
- [x] 为所有数值输入框添加 keyboard stepping 支持：
  - `size-control.ts` - Width/Height
  - `spacing-control.ts` - Margin/Padding
  - `position-control.ts` - Top/Right/Bottom/Left/Z-Index
  - `layout-control.ts` - Gap
  - `typography-control.ts` - Font Size/Line Height
  - `appearance-control.ts` - Opacity/Border Radius/Border Width

---

## 阶段一：基础视觉系统对齐 ✅ 已完成

### 1.1 颜色方案重构 ✅

**目标**：将颜色系统从当前的灰色调整为设计稿的白底+灰输入框风格

| 属性         | 旧值              | 新值                              | 状态 |
| ------------ | ----------------- | --------------------------------- | ---- |
| 面板背景     | `#f8f8f8`         | `#ffffff`                         | ✅   |
| 输入框背景   | `#f0f0f0`         | `#f3f3f3`                         | ✅   |
| 输入框 hover | `#e8e8e8` (bg)    | `border #e0e0e0` (inset)          | ✅   |
| 输入框 focus | `box-shadow` 外圈 | `inset 2px border #3b82f6` + 白底 | ✅   |
| 边框色       | `#e8e8e8`         | `#e5e5e5`                         | ✅   |

**完成的任务**：

- [x] 更新 CSS 变量定义 (`shadow-host.ts:56-97`)
- [x] 修改输入框 hover/focus 样式为 inset border 模式
- [x] 面板背景改为纯白

### 1.2 字体与字号调整 ✅

| 属性         | 旧值     | 新值                      | 状态 |
| ------------ | -------- | ------------------------- | ---- |
| 面板基础字号 | `13px`   | `11px`                    | ✅   |
| 标签字号     | `11px`   | `10px`                    | ✅   |
| 输入框字号   | `12px`   | `11px`                    | ✅   |
| 字体家族     | 系统字体 | Inter + 系统字体 fallback | ✅   |

**完成的任务**：

- [x] 添加 Inter 字体声明（使用系统字体 fallback）
- [x] 调整面板、标签、输入框的字号
- [x] 移除标签的大写样式

### 1.3 间距与边距调整 ✅

| 属性          | 旧值        | 新值       | 状态 |
| ------------- | ----------- | ---------- | ---- |
| 面板宽度      | `320px`     | `280px`    | ✅   |
| Header 内边距 | `10px 14px` | `8px 12px` | ✅   |
| Body gap      | `10px`      | `12px`     | ✅   |

**完成的任务**：

- [x] 调整 `.we-panel`, `.we-prop-body`, `.we-field-group` 的 padding/gap
- [x] 调整 header 的 padding

### 1.4 圆角与阴影 ✅

| 属性       | 旧值        | 新值               | 状态 |
| ---------- | ----------- | ------------------ | ---- |
| 面板阴影   | `0 1px 2px` | Tailwind shadow-xl | ✅   |
| 输入框圆角 | `6px`       | `4px`              | ✅   |
| Tab 阴影   | 无          | `shadow-sm`        | ✅   |

**完成的任务**：

- [x] 增强面板阴影效果（双层阴影模拟 shadow-xl）
- [x] 调整输入框圆角为 4px
- [x] 为激活的 Tab 添加阴影

### 1.5 Group/Section 样式重构 ✅

| 属性         | 旧样式      | 新样式      | 状态 |
| ------------ | ----------- | ----------- | ---- |
| Group 边框   | 卡片边框    | 无边框      | ✅   |
| Section 分隔 | 无          | 顶部分隔线  | ✅   |
| Header 样式  | 粗体 + 大字 | 11px + #333 | ✅   |

**完成的任务**：

- [x] 移除 `.we-group` 的边框和背景
- [x] 添加 Section 间的分隔线 (`border-top`)
- [x] 调整 Group header 样式

---

## 阶段二：输入容器组件重构 ✅ 基础完成

### 2.1 建立输入容器系统 ✅

**背景**：设计稿的输入框不是单体 input，而是一个容器系统，支持：

- 前缀（prefix）：标签、图标
- 后缀（suffix）：单位、图标
- 容器驱动的 hover/focus 样式

**当前结构**：

```html
<div class="we-field">
  <span class="we-field-label">Width</span>
  <input class="we-input" />
</div>
```

**目标结构**：

```html
<div class="we-field">
  <span class="we-field-label">Position</span>
  <div class="we-input-container">
    <!-- 新增容器 -->
    <span class="we-input-container__prefix">X</span>
    <!-- 可选前缀 -->
    <input class="we-input-container__input" />
    <span class="we-input-container__suffix">px</span>
    <!-- 可选后缀 -->
  </div>
</div>
```

**已完成**：

- [x] 在 `shadow-host.ts` 中定义 `.we-input-container` 样式
- [x] 定义 `.we-input-container__prefix` 和 `.we-input-container__suffix` 样式
- [x] 创建 `ui/property-panel/components/input-container.ts` 组件
- [x] 将 hover/focus 样式移到容器级别（使用 `:focus-within`）

### 2.2 更新各 Control 使用新容器 ✅ 已完成

**需要更新的控件**：

- [x] `size-control.ts` - Width/Height（2列布局 + W/H 前缀 + 动态单位后缀）
- [x] `spacing-control.ts` - Margin/Padding（重构为 2x2 网格 + 方向图标 + 动态单位后缀）
- [x] `position-control.ts` - Top/Right/Bottom/Left/Z-Index（T/R/B/L 前缀 + 动态单位后缀）
- [x] `layout-control.ts` - Gap（图标前缀 + 动态单位后缀）
- [x] `typography-control.ts` - Font Size/Line Height（动态单位后缀，line-height 智能显示）
- [ ] `appearance-control.ts` - Opacity/Border Radius/Border Width（待实施）

**已完成的共享模块**：

- [x] 创建 `css-helpers.ts` 共享模块（extractUnitSuffix, hasExplicitUnit, normalizeLength）
- [x] 所有控件使用共享 helper，消除重复代码

---

## 阶段三：Section 结构重构（待实施）

### 3.1 Tab 信息架构调整

**当前**：4 个 Tab（Design/CSS/Props/DOM）
**设计稿**：2 个 Tab（Design/CSS）

**方案选择**：

- **方案 A**：保留 4 个 Tab，调整为溢出菜单
- **方案 B**：将 Props/DOM 移到其他入口
- **方案 C**：保持 4 个 Tab，调整样式适应

**任务**：

- [ ] 确定 Tab 数量的产品决策
- [ ] 实现选定方案

---

## 阶段四：功能组件实现（待实施）

### 4.1 Flow 布局图标组 ✅ 已完成

**设计稿位置**：`attr-ui.html:133-156`
**功能**：4 个图标按钮控制 `flex-direction`

```
[→] Row
[↓] Column
[←] Row Reverse
[↑] Column Reverse
```

**已完成**：

- [x] 创建 `ui/property-panel/components/icon-button-group.ts` 通用组件
- [x] 在 `shadow-host.ts` 中添加 `.we-icon-button-group` 样式
- [x] 在 `layout-control.ts` 中用图标组替换 Direction select
- [x] 添加对应的 SVG 箭头图标（row/column/row-reverse/column-reverse）

### 4.2 Alignment 九宫格 ✅ 已完成

**设计稿位置**：`attr-ui.html:166-208`
**功能**：3x3 网格控制 `justify-content` + `align-items`

```
[↖][↑][↗]
[←][·][→]
[↙][↓][↘]
```

**已完成**：

- [x] 创建 `ui/property-panel/components/alignment-grid.ts` 组件
- [x] 在 `shadow-host.ts` 中添加 `.we-alignment-grid` 样式
- [x] 替换 `layout-control.ts` 中的 Justify/Align select
- [x] 使用 `beginMultiStyle` 实现两个属性的原子提交

### 4.3 修复 Color Picker ✅ 部分完成

**当前问题**：

- `showPicker()` 无 try/catch，可能抛错
- alpha 通道被丢弃
- token 值 `var(--xxx)` 显示不正确

**已完成**：

- [x] 添加 `showPicker()` 的错误处理（try/catch + fallback to click）
- [x] 改进 `var()` 值的解析和显示（通过 placeholder 传入 computed value）

**待实施**：

- [ ] 支持 alpha 通道（RGBA/HSLA）- 需要引入第三方 color picker
- [ ] 考虑引入第三方 color picker（如 `@simonwep/pickr`）

---

## 阶段五：新功能模块（待实施）

### 5.1 Shadow & Blur 控制

**设计稿位置**：`attr-ui.html:396-425`
**功能**：

- 启用/禁用开关
- 类型选择（Drop shadow/Inner shadow/Layer Blur/Backdrop Blur）
- 可见性控制

**CSS 属性**：

- `box-shadow`
- `filter: blur()`
- `backdrop-filter: blur()`

**任务**：

- [x] 创建 `ui/property-panel/controls/effects-control.ts`
- [x] 实现 `box-shadow` 值解析和编辑
- [x] 实现 `filter` 值解析和编辑
- [x] 实现 `backdrop-filter` 值解析和编辑
- [x] 添加类型切换 UI
- [ ] 添加启用/禁用开关（可选，后续实现）

### 5.2 渐变编辑器

**设计稿位置**：`attr-ui.html:269-325`
**功能**：

- Linear/Radial 渐变类型
- 颜色停止点（color stops）
- 角度控制
- 翻转按钮

**CSS 属性**：

- `background-image: linear-gradient(...)`
- `background-image: radial-gradient(...)`

**任务**：

- [x] 创建 `ui/property-panel/controls/gradient-control.ts`
- [x] 实现渐变值解析（CSS gradient → 数据结构）
- [x] 实现角度/位置输入
- [x] 实现 2 个颜色停止点的编辑
- [x] 集成到 property-panel（作为独立的 Gradient 控制组）
- [ ] 实现渐变预览 slider（可选，后续优化）
- [ ] 实现 color stop 添加/删除/拖拽（可选，后续优化）

### 5.3 Token/变量 Pill 显示

**设计稿位置**：`attr-ui.html:374-384`
**功能**：当值为 CSS 变量时，显示为可点击的 pill

**任务**：

- [ ] 检测 `var(--xxx)` 值
- [ ] 渲染为 pill 样式
- [ ] 点击打开 token picker

---

## 阶段六：代码质量（贯穿始终）

### 6.1 样式系统统一

- [x] 所有颜色使用 CSS 变量（阶段一完成）
- [ ] 所有尺寸使用一致的 token
- [ ] 移除 inline style，统一到 `shadow-host.ts`

### 6.2 组件复用

- [ ] 提取通用组件到 `ui/property-panel/components/`
- [ ] 统一事件处理模式
- [ ] 统一 disabled/enabled 状态处理

### 6.3 类型安全

- [ ] 所有组件使用 TypeScript 严格类型
- [ ] 定义清晰的接口和类型
- [ ] 移除 any 类型断言

---

## 实施进度

| 阶段 | 任务               | 状态    | 备注                                         |
| ---- | ------------------ | ------- | -------------------------------------------- |
| 0.1  | 最小化 Bug 修复    | ✅      | 添加全局 `[hidden]` 规则                     |
| 0.2  | 输入框优化         | ✅      | number-stepping + 真实值显示                 |
| 1.1  | 颜色方案重构       | ✅      | 白底 + 灰输入框 + inset focus                |
| 1.2  | 字体与字号调整     | ✅      | 11px 基准 + Inter 字体                       |
| 1.3  | 间距与边距调整     | ✅      | 更紧凑的布局                                 |
| 1.4  | 圆角与阴影         | ✅      | shadow-xl + 4px 圆角                         |
| 1.5  | Group/Section 样式 | ✅      | 分隔线风格                                   |
| 2.1  | 输入容器系统       | ✅      | 组件 + CSS 样式                              |
| 2.2  | 更新 Controls      | ✅      | 所有主要控件已迁移，共享 css-helpers.ts      |
| 3.1  | Tab 信息架构       | 待实施  |                                              |
| 4.1  | Flow 图标组        | ✅      | icon-button-group.ts + 集成到 layout-control |
| 4.2  | Alignment 九宫格   | ✅      | alignment-grid.ts + 集成到 layout-control    |
| 4.3  | 修复 Color Picker  | ✅ 部分 | showPicker 异常处理 + var() 解析             |
| 5.1  | Shadow & Blur      | ✅      | effects-control.ts + 集成到 property-panel   |
| 5.2  | 渐变编辑器         | ✅      | gradient-control.ts + 集成到 property-panel  |
| 5.3  | Token Pill         | 待实施  |                                              |

---

## 注意事项

1. **渐进式实施**：每个 Phase 完成后应可独立测试和发布
2. **保持向后兼容**：重构过程中不应破坏现有功能
3. **设计决策记录**：遇到设计稿与实际需求冲突时，记录决策原因
4. **性能考虑**：新增组件需考虑渲染性能，避免不必要的 DOM 操作
