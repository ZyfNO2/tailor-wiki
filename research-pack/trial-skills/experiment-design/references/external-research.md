# 既有外部参考的补充研究

核查日期：2026-10-25。沿用旧 REFERENCE-RESEARCH.md 中的固定版本，重新读取与实验有关的原始文件；旧文档的总 Skill/Core/UI 路线不再作为本 Skill 的前提。这里只提炼机制，未运行参考项目。

## MLflow：把实验记录拆清楚

固定 commit：77f1affa42901e85cf4355587750d60d21e96aa1。

- [RunInfo](https://github.com/mlflow/mlflow/blob/77f1affa42901e85cf4355587750d60d21e96aa1/mlflow/entities/run_info.py)：运行身份、归属、状态、起止时间和产物位置。
- [RunData](https://github.com/mlflow/mlflow/blob/77f1affa42901e85cf4355587750d60d21e96aa1/mlflow/entities/run_data.py)：指标、参数和标签分开。

采用：每次真实尝试有身份，配置和原始产物可追回；运行完成与研究结论分开。不把“能存指标”解释为指标已经可比，也不把该模型视为来源版本或科研判断的完整契约。无需 MLflow Server/SDK，本地文件即可实现这些记录。

## autoresearch：保留完整尝试

固定 commit：228791fb499afffb54b46200aca536f79142f117；已重读 [program.md](https://github.com/karpathy/autoresearch/blob/228791fb499afffb54b46200aca536f79142f117/program.md)。

采用：限定可变范围、先建立基线、记录全部尝试及保留/淘汰原因、考虑复杂度成本。仅学习机制，不复制提示词或代码。

调整：原方案的固定 5 分钟训练只适合它的具体问题，不是通用公平标准；不移植无限运行、自动 Git 重置。原台账将 crash 指标填零，本 Skill 改为缺失值加原因，防止低值更优时把失败判为优胜。无指标不能单凭日志 grep 判定崩溃，需核实进程与评价状态。

## NeurIPS：用主张反查证据

官方 [Paper Checklist](https://neurips.cc/public/guides/PaperChecklist)，本次读取 Claims、Experimental Setting、Statistical Significance、Compute Resource 等条目。

采用其“主张应与结果范围一致”的要求，记录划分与调参选择、误差来源及运行资源。这里借鉴报告原则，不把 NeurIPS 的投稿形式强制用于所有项目，也不声称检查表能证明创新成立。

## 本项目的额外设计

“候选/计划→Run→采纳决定”的文件关系、测试集使用边界、原文/真实/模拟分开、缺失指标处理，以及按问题选消融矩阵，是结合本项目约束制定的流程；不声称某一个参考项目完整实现了它们。Refly/OpenHands 的界面机制不影响此 Skill 的实验设计，暂不扩展。
