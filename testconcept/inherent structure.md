## 固有结构

“固有结构”（Inherent Structure, IS）这一概念为理解液体和无定形固体（玻璃）的性质提供了一个基本框架。它将复杂的原子运动分解为两个部分：围绕局部平衡位置的振动，以及在这些位置之间的跃迁。这是势能面（Potential Energy Landscape, PEL）理论中的一个核心思想。

**势能面（PEL）** 是一个高维曲面，由系统的势能 $V$ 定义，该势能是其所有组成粒子集体坐标 $\mathbf{R} = \{\mathbf{r}_1, \mathbf{r}_2, ..., \mathbf{r}_N\}$ 的函数。

$$
V(\mathbf{R}) = V(\mathbf{r}_1, \mathbf{r}_2, ..., \mathbf{r}_N)
$$

其中：
*   $V$ 是系统的总势能。
*   $N$ 是粒子数。
*   $\mathbf{r}_i$ 是第 $i$ 个粒子的位置矢量。
*   $\mathbf{R}$ 是一个 $3N$ 维矢量，代表系统的构型。

一个**固有结构**，记作 $\mathbf{R}_{IS}$，是对应于该势能面上一个局部极小值的构型。在数学上，这由两个条件定义：

1.  **梯度为零（无力条件）：** 每个粒子上的净力为零。这意味着该构型是势能的一个驻点。
    $$
    \mathbf{F}(\mathbf{R}_{IS}) = -\nabla V(\mathbf{R}_{IS}) = 0
    $$
    其中 $\nabla$ 是相对于 $\mathbf{R}$ 中 $3N$ 个坐标的梯度算子。

2.  **正定海森矩阵（稳定性条件）：** 该构型在任何微小扰动下都是稳定的。如果势能的海森矩阵 $\mathbf{H}$ 在 $\mathbf{R}_{IS}$ 处的特征值全部为正，则可以确保这一点。
    $$
    \mathbf{H}_{ij} = \frac{\partial^2 V}{\partial \mathbf{r}_i \partial \mathbf{r}_j} \bigg|_{\mathbf{R}=\mathbf{R}_{IS}}
    $$
    $\mathbf{H}$ 的特征值对应于围绕该极小值振动的简正模频率的平方。正特征值确保所有振动频率都是实数，表明这是一个真正的极小值点。

PEL 被划分为多个“吸引盆”。每个盆对应于所有构型的集合，这些构型在能量最小化（例如，最速下降法）后将映射到同一个固有结构。在任何给定时刻，温度为 $T$ 的液体系统由于热能而具有一个波动的构型 $\mathbf{R}(t)$。该构型位于一个特定的盆内。寻找相应固有结构的过程等同于一次“淬火”，该过程移除了所有动能，使系统弛豫到其当前所占据的盆的底部。

```mermaid
graph TD
    subgraph "Potential Energy Landscape 势能面"
        A["Instantaneous Liquid Configuration<br>瞬时液体构型<br>E_total = K + V"] -->|Energy Minimization / Quench<br>能量最小化 / 淬火| B["Inherent Structure<br>固有结构<br>E_IS = V_min"];
        B -->|Vibrational Motion<br>振动| C["Basin of Attraction<br>吸引盆[";
        A -- "Thermal Fluctuations<br>热涨落" --- C;
        B -- "Normal Mode Analysis<br>简正模分析" --> D["Vibrational Frequencies<br>振动频率"];
    end

    style B fill:#ccf,stroke:#333,stroke-width:2px
    style C fill:#f9f,stroke:#333,stroke-width:1px,stroke-dasharray: 5 5
```

### 关键技术规格

固有结构的确定和性质高度依赖于模拟参数。下表列出了一项旨在研究固有结构的典型分子动力学（MD）模拟的关键规格，以标准的 Lennard-Jones（LJ）系统为例。

| 参数 | 符号 | 典型值 | 单位 | 描述 |
| :--- | :--- | :--- | :--- | :--- |
| 相互作用势 | $V_{LJ}(r)$ | Lennard-Jones | - | 定义势能面。$V_{LJ}(r) = 4\epsilon [(\sigma/r)^{12} - (\sigma/r)^6]$ |
| 粒子数 | $N$ | $10^3 - 10^6$ | - | 系统尺寸。影响有限尺寸效应和计算成本。 |
| 约化密度 | $\rho^*$ | 0.8 - 1.2 | - | $\rho^* = \rho \sigma^3$。决定系统的堆积方式。 |
| 约化温度 | $T^*$ | 0.4 - 2.0 | - | $T^* = k_B T / \epsilon$。控制淬火前液体的热能。 |
| 淬火方法 | - | 共轭梯度法 / FIRE | - | 用于能量最小化的算法。 |
| 力收敛阈值 | $F_{tol}$ | $< 10^{-8}$ | $\epsilon / \sigma$ | 最小化算法的收敛判据。任何粒子上的最大力分量。 |
| 淬火频率 | $f_q$ | 0.01 - 1.0 | $(\tau_{LJ})^{-1}$ | 从MD轨迹中采样构型进行淬火的频率。$\tau_{LJ} = \sigma\sqrt{m/\epsilon}$。 |

### 常见用例

固有结构是分析无序系统结构和动力学的主要工具。

*   **玻璃化转变分析：** 当液体冷却至其玻璃化转变温度 $T_g$ 时，固有结构系综的性质会发生显著变化。平均固有结构能量 $\langle E_{IS} \rangle$ 随温度降低而减小。势能面变得“更粗糙”，盆之间的能垒更高。
    *   **性能指标：** $\langle E_{IS} \rangle$ vs. $T$ 的斜率可以指示液体可及构型空间的变化。对于一个脆性玻璃形成体，典型的结果显示 $\langle E_{IS} \rangle$ 在 $T_g$ 以上急剧下降，而在 $T_g$ 以下则表现出弱得多的依赖性。
*   **振动态密度（VDOS）：** 通过对固有结构处的海森矩阵进行对角化，可以计算出简正模频率 $\omega_i$。这些频率的分布 $g(\omega)$ 即为VDOS。
    *   **性能指标：** 在玻璃中，VDOS 表现出“玻色峰”，即与晶体的德拜 $g(\omega) \propto \omega^2$ 预测相比，在低频区存在过量的模式。该峰的位置和高度是与材料弹性和热学性质相关的关键量化指标。对于非晶硅，玻色峰通常在 1 THz 附近被观察到。
*   **力学性质：** 玻璃的弹性模量（例如，剪切模量 $G$，体弹模量 $K$）可以直接从固有结构对施加应变的响应中计算出来。
    $$
    G = \frac{1}{V} \frac{\partial^2 E_{IS}}{\partial \gamma^2} \bigg|_{\gamma=0}
    $$
    *   **性能指标：** 对于一个在 $\rho^*=1.0$ 的 Lennard-Jones 玻璃，从固有结构计算出的剪切模量通常在 $G^* = G \sigma^3 / \epsilon \approx 20-30$ 的范围内，统计不确定度为 $\pm 5\%$，具体取决于系综的大小。

### 实现考量

寻找固有结构是一个数值优化问题。目标是从一个初始构型 $\mathbf{R}_0$ 出发，找到一个 $\mathbf{R}_{IS}$ 使得 $V(\mathbf{R}_{IS})$ 是一个局部极小值。

```mermaid
graph TD
    Start["Initial Configuration R_0<br>初始构型 R_0"] --> CalcForce["Calculate Force F = -∇VR<br>计算力 F = -∇VR"];
    CalcForce --> CheckConv["Is ||F|| < F_tol?<br>||F|| < F_tol ?[";
    CheckConv -- "Yes<br>是" --> End["End: R is an Inherent Structure<br>结束: R为固有结构"];
    CheckConv -- "No<br>否" --> UpdatePos["Update Particle Positions<br>更新粒子位置"];
    UpdatePos --> CalcForce;

    subgraph "Update Algorithms 更新算法"
        SD["Steepest Descent<br>最速下降法<br>R_new = R + αF"]
        CG["Conjugate Gradient<br>共轭梯度法<br>使用先前的梯度信息"]
        FIRE["FIRE Algorithm<br>FIRE算法<br>引入“惯性”和自适应时间步长"]
    end

    UpdatePos --> SD;
    UpdatePos --> CG;
    UpdatePos --> FIRE;

    style End fill:#ccffcc,stroke:#006600
```

*   **最速下降法（Steepest Descent, SD）：** 最简单的方法。粒子沿着力的方向（梯度的反方向）移动。
    $$
    \mathbf{R}_{k+1} = \mathbf{R}_k + \alpha \mathbf{F}(\mathbf{R}_k)
    $$
    其中 $\alpha$ 是一个小的固定步长。
    *   **复杂度：** $O(N_{iter} \cdot N \cdot \langle k \rangle)$，其中 $N_{iter}$ 是迭代次数，$N$ 是粒子数，$\langle k \rangle$ 是势能截断半径内的平均邻居数。保证收敛，但在势能面的“狭长山谷”中可能非常缓慢。

*   **共轭梯度法（Conjugate Gradient, CG）：** 通过选择与先前方向共轭的搜索方向来改进SD，避免了沿相同路径的重复最小化。这通常导致更快的收敛速度。
    *   **复杂度：** 每次迭代的复杂度与SD相同，但 $N_{iter}$ 显著降低。

*   **快速惯性弛豫引擎（Fast Inertial Relaxation Engine, FIRE）：** 物理学中一种流行的算法，它引入了一种带有“惯性”的改进分子动力学方案。速度根据力与速度矢量点积的符号进行调整。如果 $P = \mathbf{F} \cdot \mathbf{v} > 0$，则运动是下坡的，时间步长增加。如果 $P < 0$，系统已越过一个极小值，则速度重置为零，时间步长减小。
    *   **复杂度：** 每次迭代的复杂度与SD相同，但对于典型的无序系统，其收敛速度通常比CG更快。它很稳健，几乎不需要参数调整。

### 性能特征

固有结构的性质本质上是统计性的，反映了其淬火来源的母体液体的热力学。

*   **固有结构能量的分布：** 对于在温度 $T$ 下处于平衡态的液体，从不同时间采样的构型进行淬火将导致不同的固有结构。这些固有结构的能量 $E_{IS}$ 服从一个分布 $P(E_{IS})$。该分布近似为高斯分布。
    *   **均值：** $\langle E_{IS}(T) \rangle$。随着液体冷却，该值减小，因为势能面上能量更低的区域变得可及。
    *   **方差：** $\sigma^2_{IS}(T) = \langle E_{IS}^2 \rangle - \langle E_{IS} \rangle^2$。该方差与比热的“构型”部分有关。
*   **构型熵：** 固有结构的概念允许对构型熵 $S_c$ 进行一个实际的定义，它计算了系统可及的不同盆（固有结构）的数量。根据势能面图像：
    $$
    S_c(T) \approx k_B \ln \Omega_c(T)
    $$
    其中 $\Omega_c(T)$ 是在温度 $T$ 下可及的固有结构的数量。所谓的考兹曼佯谬，即过冷液体的熵在某个温度下低于晶体的熵，通常用 $S_c$ 在有限温度 $T_K$ 处趋于零来讨论。

### 相关技术与概念

*   **简正模分析（Normal Mode Analysis, NMA）：** 如前所述，NMA 是在固有结构上进行的。它涉及计算和对角化海森矩阵 $\mathbf{H}$。特征值给出了振动频率的平方 $\{\omega_i^2\}$，特征向量给出了每个模式的位移模式。这是计算 VDOS 和识别局域与非局域模式的标准方法。

*   **阻塞转变（Jamming Transition）：** 这是非热（$T=0$）粒子系统相图中的一个临界点。一个阻塞态是一个力学稳定且能抵抗剪切的固有结构。在密度 $\phi_J$ 处的阻塞转变标志着刚性的出现。
    *   **数学模型比较：**
        *   **固有结构（玻璃）：** 通过淬火热液体（$\rho > \rho_J$, $T>0 \to T=0$）得到。系统具有非零的压力和体弹模量。
        *   **阻塞态（J点）：** 在临界堆积分数 $\phi_J$ 处的一个特定固有结构，其压力为零。它是等静定的，意味着接触数刚好足以确保力学稳定性。剪切模量 $G$ 在转变点恰好为零。
        *   **数学区分：** 对于势能为 $V(r) \propto (1-r/d)^{2}$（对于重叠粒子 $r<d$）的软球系统：
            *   阻塞态：$P \to 0^+$，配位数 $Z \to Z_{iso} = 2d_f$，其中 $d_f$ 是自由度数。
            *   玻璃态固有结构：$P > 0$，$Z > Z_{iso}$。

*   **复型理论（Replica Theory）：** 一种源于自旋玻璃研究的理论物理框架，用于解析计算玻璃态系统的性质。它涉及使用“复型技巧”对无序进行平均。该理论预测了一个与解空间结构变化相关的相变（动力学转变和静态/考兹曼转变），这可以用 PEL 及其固有结构的语言来解释。

### 参考文献
*   Stillinger, F. H., & Weber, T. A. (1982). Hidden structure in liquids. *Physical Review A*, 25(2), 978–989. DOI: [10.1103/PhysRevA.25.978](https://doi.org/10.1103/PhysRevA.25.978)
*   Stillinger, F. H. (1995). A topographic view of supercooled liquids and glass formation. *Science*, 267(5206), 1935–1939. DOI: [10.1126/science.267.5206.1935](https://doi.org/10.1126/science.267.5206.1935)
*   Bitzek, E., Koskinen, P., Gähler, F., Moseler, M., & Gumbsch, P. (2006). Structural Relaxation Made Simple. *Physical Review Letters*, 97(17), 170201. DOI: [10.1103/PhysRevLett.97.170201](https://doi.org/10.1103/PhysRevLett.97.170201) (The FIRE algorithm)
*   Heuer, A. (2008). The potential energy landscape of glasses. *Journal of Physics: Condensed Matter*, 20(37), 373101. DOI: [10.1088/0953-8984/20/37/373101](https://doi.org/10.1088/0953-8984/20/37/373101)