## 非定常态 (nonstationary state)

非定常态是一个基础但至关重要的科学概念，其核心思想是系统的某些关键属性会随时间演化。此概念横跨多个学科，包括量子力学、统计过程和热力学，但在不同领域中具有特定的数学表述和物理内涵。本技术文档将重点阐述其在量子力学和时间序列分析中的严格定义、数学基础和应用。

### 1. 核心概念与数学基础

非定常态的定义取决于其应用领域。我们将分别探讨两个主要领域的定义。

#### 1.1 量子力学中的非定常态

在量子力学中，一个系统的状态由波函数（或状态矢量）$|\Psi(t)\rangle$ 描述。一个状态是否为“定常”取决于其是否为系统哈密顿算符 $\hat{H}$ 的本征态。

**定常态 (Stationary State):**
如果一个系统处于哈密顿算符 $\hat{H}$ 的一个本征态 $|\psi_n\rangle$，其本征值为能量 $E_n$，即 $\hat{H}|\psi_n\rangle = E_n|\psi_n\rangle$，那么该状态就是一个定常态。其含时演化的波函数为：
$$
|\Psi_n(t)\rangle = e^{-iE_n t/\hbar} |\psi_n\rangle
$$
其中：
*   $|\Psi_n(t)\rangle$ 是系统在时间 $t$ 的状态矢量。
*   $|\psi_n\rangle$ 是不含时的本征态。
*   $E_n$ 是该状态的能量本征值。
*   $\hbar$ 是约化普朗克常数 ($1.054 \times 10^{-34} \text{ J·s}$)。
*   $i$ 是虚数单位。

对于定常态，其可观测量的概率密度是与时间无关的。例如，位置的概率密度为：
$$
P(x,t) = |\langle x | \Psi_n(t) \rangle|^2 = |\langle x | e^{-iE_n t/\hbar} |\psi_n\rangle|^2 = |e^{-iE_n t/\hbar}|^2 |\langle x | \psi_n \rangle|^2 = |\psi_n(x)|^2
$$
由于 $|e^{-iE_n t/\hbar}|^2 = 1$，概率密度 $P(x,t)$ 不随时间变化。

**非定常态 (Nonstationary State):**
非定常态是**多个能量本征态的线性叠加**。根据叠加原理，一个普遍的量子态可以写成：
$$
|\Psi(t)\rangle = \sum_n c_n |\Psi_n(t)\rangle = \sum_n c_n e^{-iE_n t/\hbar} |\psi_n\rangle
$$
其中：
*   $c_n = \langle \psi_n | \Psi(0) \rangle$ 是在初始时刻 $t=0$ 系统处于本征态 $|\psi_n\rangle$ 的概率幅，且满足归一化条件 $\sum_n |c_n|^2 = 1$。

对于非定常态，其概率密度通常是**随时间演化**的。以两个态的叠加为例，$|\Psi(t)\rangle = c_1 e^{-iE_1 t/\hbar} |\psi_1\rangle + c_2 e^{-iE_2 t/\hbar} |\psi_2\rangle$。其概率密度为：
$$
\begin{aligned}
P(x,t) &= |\Psi(x,t)|^2 = \left( c_1^* e^{iE_1 t/\hbar} \psi_1^*(x) + c_2^* e^{iE_2 t/\hbar} \psi_2^*(x) \right) \left( c_1 e^{-iE_1 t/\hbar} \psi_1(x) + c_2 e^{-iE_2 t/\hbar} \psi_2(x) \right) \\
&= |c_1|^2 |\psi_1(x)|^2 + |c_2|^2 |\psi_2(x)|^2 + c_1^* c_2 e^{i(E_1-E_2)t/\hbar} \psi_1^*(x)\psi_2(x) + c_2^* c_1 e^{-i(E_1-E_2)t/\hbar} \psi_2^*(x)\psi_1(x) \\
&= |c_1|^2 |\psi_1(x)|^2 + |c_2|^2 |\psi_2(x)|^2 + 2 \text{Re} \left[ c_1^* c_2 \psi_1^*(x)\psi_2(x) e^{-i(E_2-E_1)t/\hbar} \right]
\end{aligned}
$$
最后一个交叉项（干涉项）包含了振荡因子 $e^{-i\omega_{21}t}$，其中 $\omega_{21} = (E_2-E_1)/\hbar$ 是跃迁频率，这导致了概率密度的含时演化，称为**量子拍 (Quantum Beat)**。

```mermaid
graph TD
    subgraph "量子态的分类 Quantum State Classification"
        QuantumState["通用量子态 General Quantum State<br>|Ψt⟩"]
        IsEigenstate["是哈密顿算符的本征态? Is it an eigenstate of the Hamiltonian?["
        
        QuantumState --> IsEigenstate
        IsEigenstate -- "是 Yes" --> StationaryState["定常态 Stationary State<br>单一能量本征态 Single Energy Eigenstate<br>Px, t = Px"]
        IsEigenstate -- "否 No" --> NonstationaryState["非定常态 Nonstationary State<br>能量本征态的叠加 Superposition of Energy Eigenstates"]
        
        NonstationaryState --> TimeEvolution["概率密度随时间演化 Time-Evolving Probability Density<br>Px, t"]
        TimeEvolution --> Interference["干涉项 Interference Terms<br>exp[-iE_n - E_mt/ħ]"]
        Interference --> QuantumBeat["量子拍 Quantum Beat<br>振荡频率 ω = E_n - E_m/ħ"]
    end

    style StationaryState fill:#ccffcc,stroke:#006600
    style NonstationaryState fill:#ffcccc,stroke:#990000
```

#### 1.2 时间序列分析中的非定常态

在统计学和信号处理中，一个时间序列（或随机过程）$X(t)$ 的非定常性指的是其统计特性随时间变化。通常我们关注**弱平稳性（Weak-Sense Stationarity）**，其定义要求满足以下两个条件：
1.  **均值恒定**: 均值函数 $\mu_X(t)$ 是一个与时间 $t$ 无关的常数 $\mu$。
    $$ E[X(t)] = \mu $$
2.  **自协方差函数仅依赖于时间差**: 自协方差函数 $C_X(t_1, t_2)$ 只依赖于时间间隔 $\tau = t_1 - t_2$。
    $$ C_X(t_1, t_2) = E[(X(t_1) - \mu)(X(t_2) - \mu)] = \gamma_X(\tau) $$

一个**非定常时间序列**是至少违反上述条件之一的过程。

### 2. 关键技术规格

非定常时间序列可以根据其违反平稳性的方式进行分类。

| 类型 (Type) | 描述 (Description) | 数学表示 (Mathematical Representation) |
| :--- | :--- | :--- |
| **趋势平稳 (Trend-Stationary)** | 序列包含一个确定性趋势。移除该趋势后，剩余部分是平稳的。 | $X_t = f(t) + \epsilon_t$, 其中 $f(t)$ 是确定性函数（如 $\alpha + \beta t$），$\epsilon_t$ 是平稳过程。 |
| **差分平稳 (Difference-Stationary)** | 序列包含一个随机趋势（单位根）。通过一次或多次差分可以使其平稳。 | $X_t = X_{t-1} + c + \epsilon_t$ (含漂移的随机游走)。差分后 $\Delta X_t = X_t - X_{t-1} = c + \epsilon_t$ 是平稳的。 |
| **结构性断裂 (Structural Break)** | 序列的统计特性（如均值或方差）在某个时间点发生突变。 | $\mu_X(t) = \mu_1$ for $t \le T_{break}$; $\mu_X(t) = \mu_2$ for $t > T_{break}$。 |
| **异方差性 (Heteroskedasticity)** | 序列的方差随时间变化。 | $\text{Var}(X_t) = \sigma_t^2$，其中 $\sigma_t^2$ 不是常数。例如 GARCH 模型。 |

### 3. 常见用例与量化指标

| 领域 (Domain) | 用例 (Use Case) | 关键非定常特征 (Key Nonstationary Feature) | 量化性能指标 (Quantitative Performance Metric) |
| :--- | :--- | :--- | :--- |
| **量子物理** | 激光诱导的原子跃迁 | 电子在不同能级间的叠加态，导致布居数随时间振荡。 | 跃迁速率 (Transition Rate): $W_{k \to n} \propto |\langle \psi_n | \hat{V} | \psi_k \rangle|^2$ (费米黄金定则)；振荡周期: $T = 2\pi\hbar/(E_n-E_k)$，通常在飞秒 (fs) 到皮秒 (ps) 量级。 |
| **量子计算** | 量子比特的门操作 | 通过施加外部脉冲，使量子比特从 $|0\rangle$ 演化到 $\alpha|0\rangle + \beta|1\rangle$ 的叠加态。 | 门保真度 (Gate Fidelity): $> 99.9\%$; 操作时间: 纳秒 (ns) 量级。 |
| **经济学** | GDP、股价预测 | 趋势平稳性或单位根过程。 | 预测均方根误差 (RMSE): $10^9$ USD (对于GDP)；夏普比率 (Sharpe Ratio): $> 1.0$ (对于投资策略)。 |
| **气候科学** | 全球温度序列分析 | 显著的上升趋势和可能的结构性断裂。 | 趋势斜率: $0.18 \pm 0.05$ °C/十年 (1981-2020)；模型拟合的 $R^2 > 0.9$。 |
| **信号处理** | 语音信号识别 | 信号的频谱特性在音素级别上快速变化。 | 词错误率 (Word Error Rate, WER): < 5%；梅尔频率倒谱系数 (MFCC) 的时变性。 |

### 4. 实现考量与算法复杂度

在时间序列分析中，处理非定常性是建模前至关重要的一步。

#### 4.1 平稳性检验
在建模之前，必须检验序列的平稳性。

*   **增广迪基-福勒检验 (Augmented Dickey-Fuller, ADF Test)**
    *   **目的**: 检验单位根的存在性。
    *   **原假设 ($H_0$)**: 序列存在单位根（非定常）。
    *   **备择假设 ($H_a$)**: 序列是平稳的（或趋势平稳的）。
    *   **检验统计量**: $ADF = \hat{\gamma} / \text{SE}(\hat{\gamma})$ 来自回归模型 $\Delta y_t = \alpha + \beta t + \gamma y_{t-1} + \sum_{i=1}^p \delta_i \Delta y_{t-i} + \epsilon_t$。
*   **KPSS 检验 (Kwiatkowski-Phillips-Schmidt-Shin Test)**
    *   **目的**: 检验平稳性。
    *   **原假设 ($H_0$)**: 序列是（趋势）平稳的。
    *   **备择假设 ($H_a$)**: 序列存在单位根。

ADF和KPSS的假设是相反的，通常将两者结合使用以获得更可靠的结论。

#### 4.2 处理非定常性的算法

| 算法 (Algorithm) | 目标非定常性 (Target Nonstationarity) | 算法复杂度 (Algorithmic Complexity) |
| :--- | :--- | :--- |
| **差分 (Differencing)** | 单位根过程 | $O(N)$, 其中 $N$ 是序列长度。 |
| **去趋势 (Detrending)** | 趋势平稳 | $O(N)$ (对于线性趋势，使用最小二乘法)。 |
| **对数/Box-Cox变换** | 异方差性 | $O(N)$。 |
| **小波变换 (Wavelet Transform)** | 局部时频特性 | $O(N \log N)$ (对于快速小波变换)。 |

### 5. 性能特征与统计度量

未能正确处理非定常性会导致严重的统计问题。

*   **伪回归 (Spurious Regression)**: 对两个独立的非定常序列（如随机游走）进行回归，可能会得到非常高的决定系数 ($R^2$) 和显著的t统计量，但两者之间并无实际因果关系。
    *   **特征**: $R^2 \to 1$ 且 Durbin-Watson 统计量 $\to 0$ 当样本量 $N \to \infty$。
*   **对预测的影响**: 如果模型假设了平稳性而数据是非定常的，那么模型的长期预测会发散，置信区间会无限扩大，失去实际意义。

**示例：ADF检验结果**
假设对某股价序列进行ADF检验，得到如下典型输出：
*   ADF Statistic: -1.25
*   p-value: 0.65
*   Critical Values:
    *   1%: -3.43
    *   5%: -2.86
    *   10%: -2.57

**结论**: ADF统计量 (-1.25) 大于所有临界值，且p值 (0.65) 远大于显著性水平 (如0.05)。因此，我们**不能拒绝原假设**，即序列很可能存在单位根，是非定常的。

### 6. 相关技术与比较模型

#### 6.1 量子力学中的等价描述

在量子力学中，除了薛定谔绘景（状态演化，算符不变），还可以使用海森堡绘景来描述动力学。

| 绘景 (Picture) | 状态矢量 (State Vector) | 算符 (Operator) | 期望值演化 (Expectation Value Evolution) |
| :--- | :--- | :--- | :--- |
| **薛定谔绘景** | $|\Psi(t)\rangle = e^{-i\hat{H}t/\hbar}|\Psi(0)\rangle$ (演化) | $\hat{A}_S$ (不变) | $\langle A \rangle_t = \langle \Psi(t) | \hat{A}_S | \Psi(t) \rangle$ |
| **海森堡绘景** | $|\Psi_H\rangle = |\Psi(0)\rangle$ (不变) | $\hat{A}_H(t) = e^{i\hat{H}t/\hbar} \hat{A}_S e^{-i\hat{H}t/\hbar}$ (演化) | $\langle A \rangle_t = \langle \Psi_H | \hat{A}_H(t) | \Psi_H \rangle$ |

两种绘景在物理上是等价的。在海森堡绘景中，即使状态本身是“静止”的，可观测算符的演化也完全捕捉了系统的非定常动力学。

#### 6.2 处理非定常时间序列的模型

```mermaid
graph TD
    subgraph "处理非定常时间序列的模型 Models for Nonstationary Time Series"
        NonstationaryData["非定常数据 Nonstationary Data"]
        
        NonstationaryData --> HasUnitRoot["存在单位根? Has Unit Root?["
        HasUnitRoot -- "是 Yes" --> ARIMA["ARIMA 模型 ARIMA Model<br>通过差分 I 处理随机趋势 Handles random trends via differencing I"]
        
        NonstationaryData --> HasTimeVaryingVariance["存在时变方差? Has Time-Varying Variance?["
        HasTimeVaryingVariance -- "是 Yes" --> GARCH["GARCH 模型 GARCH Model<br>对条件异方差进行建模 Models conditional heteroskedasticity"]
        
        NonstationaryData --> HasLatentState["存在潜在状态/结构性断裂? Has Latent State / Structural Breaks?["
        HasLatentState -- "是 Yes" --> StateSpace["状态空间模型 State-Space Models<br>例如卡尔曼滤波器 e.g., Kalman Filter<br>显式建模时变参数 Explicitly models time-varying parameters"]
        
        ARIMA --> Forecast1["点预测和区间预测 Point and Interval Forecasts"]
        GARCH --> VolatilityForecast["波动率预测 Volatility Forecasts"]
        StateSpace --> FilteredState["状态估计和平滑 State Estimation and Smoothing"]
    end

    style ARIMA fill:#ccf,stroke:#333,stroke-width:2px
    style GARCH fill:#cfc,stroke:#333,stroke-width:2px
    style StateSpace fill:#cff,stroke:#333,stroke-width:2px
```

**模型比较:**

*   **ARIMA (Autoregressive Integrated Moving Average)**:
    *   模型: $\phi(L)(1-L)^d X_t = \theta(L)\epsilon_t$
    *   $d$ 是差分阶数，用于消除单位根。它将非定常问题转化为平稳问题进行建模。
*   **GARCH (Generalized Autoregressive Conditional Heteroskedasticity)**:
    *   模型: $\sigma_t^2 = \omega + \sum_{i=1}^q \alpha_i \epsilon_{t-i}^2 + \sum_{j=1}^p \beta_j \sigma_{t-j}^2$
    *   专门用于对均值平稳但方差非平稳的序列（波动率聚集）进行建模。
*   **状态空间模型 (State-Space Models)**:
    *   观测方程: $y_t = Z_t \alpha_t + \epsilon_t$
    *   状态方程: $\alpha_{t+1} = T_t \alpha_t + R_t \eta_t$
    *   这是一个非常灵活的框架，可以处理趋势、季节性、结构性断裂和时变参数，通过卡尔曼滤波器进行估计。

### 7. 参考文献 (References)

1.  Cohen-Tannoudji, C., Diu, B., & Laloë, F. (1977). *Quantum Mechanics, Volume 1*. Wiley-VCH. (A foundational text on stationary and nonstationary states in quantum mechanics).
2.  Dickey, D. A., & Fuller, W. A. (1979). Distribution of the Estimators for Autoregressive Time Series with a Unit Root. *Journal of the American Statistical Association*, 74(366a), 427-431. DOI: `10.1080/01621459.1979.10482531`
3.  Hamilton, J. D. (1994). *Time Series Analysis*. Princeton University Press. (A comprehensive reference for stationary and nonstationary time series).
4.  Haroche, S. (2001). "Quantum beats and their revival: A personal account." In *The Quantum World: Philosophical Debates on Quantum Physics* (pp. 1-22). Les Ulis: EDP Sciences. (Provides a detailed account of the experimental observation of quantum beats, a direct consequence of nonstationary states).