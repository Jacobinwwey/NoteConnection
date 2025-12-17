## 全原子水模型

全原子水模型是计算化学和分子动力学（MD）模拟中用于描述液态水行为的一类经典力场模型。其核心思想是明确地表示水分子中的每一个原子（一个氧原子和两个氢原子），并通过一个势能函数来描述原子间的相互作用。这些模型旨在以可接受的计算成本，准确再现水的宏观物理化学性质（如密度、扩散系数、介电常数等）和微观结构（如径向分布函数）。

### 核心概念与数学基础

全原子水模型的基础是势能函数 $U(\mathbf{r}^N)$，它描述了包含 $N$ 个原子的系统在给定构型 $\mathbf{r}^N$ 下的总势能。对于非极化的刚性水模型（最常见的一类），该函数通常由两部分组成：范德华相互作用和静电相互作用。

系统的总势能可以表示为分子间相互作用能的总和：

$$
U(\mathbf{r}^N) = \sum_{i<j} U_{ij}(r_{ij})
$$

其中，$U_{ij}$ 是分子 $i$ 和分子 $j$ 之间的相互作用能，它进一步分解为对所有原子对 $(a \in i, b \in j)$ 的作用总和。对于水模型，这通常只涉及非键相互作用。

$$
U_{ij} = \sum_{a \in i} \sum_{b \in j} \left( U_{\text{LJ}}(r_{ab}) + U_{\text{Coulomb}}(r_{ab}) \right)
$$

1.  **Lennard-Jones (LJ) 势**: 该项描述了原子间的短程排斥和长程吸引（范德华力），通常仅在氧原子之间计算，以模拟分子的大小和色散力。

    $$
    U_{\text{LJ}}(r_{ab}) = 4\epsilon_{ab} \left[ \left( \frac{\sigma_{ab}}{r_{ab}} \right)^{12} - \left( \frac{\sigma_{ab}}{r_{ab}} \right)^{6} \right]
    $$

    *   $r_{ab}$: 原子 $a$ 和 $b$ 之间的距离。
    *   $\epsilon_{ab}$: 势阱深度，描述了吸引力的强度。
    *   $\sigma_{ab}$: 有限距离处的原子间距，其中势能为零，代表了原子的有效直径。
    *   对于不同原子类型间的相互作用，通常使用混合规则（如Lorentz-Berthelot规则）计算交叉参数：
        *   $\sigma_{ab} = \frac{\sigma_{aa} + \sigma_{bb}}{2}$
        *   $\epsilon_{ab} = \sqrt{\epsilon_{aa} \epsilon_{bb}}$

2.  **库仑 (Coulomb) 势**: 该项描述了原子上固定的点电荷之间的静电相互作用。

    $$
    U_{\text{Coulomb}}(r_{ab}) = \frac{1}{4\pi\epsilon_0} \frac{q_a q_b}{r_{ab}}
    $$

    *   $q_a, q_b$: 原子 $a$ 和 $b$ 上的部分点电荷。
    *   $\epsilon_0$: 真空介电常数。
    *   在模拟软件中，常数项 $\frac{1}{4\pi\epsilon_0}$ 通常被合并到一个能量转换因子中。

对于刚性水模型，O-H键长和H-O-H键角被固定为其平衡值。这通过约束算法（如SHAKE或RATTLE）在模拟过程中实现，从而移除了高频振动，允许使用更大的时间步长。因此，键伸缩和角弯曲的势能项（如 $k_b(r-r_0)^2$ 和 $k_\theta(\theta-\theta_0)^2$）在势能函数中被省略。

#### 模型几何结构

全原子水模型根据电荷和LJ中心的分布，可分为不同类型。

```mermaid
graph TD
    subgraph "水模型几何分类 Water Model Geometries"
        M3["3-点位模型 3-Site"]
        M4["4-点位模型 4-Site"]
        M5["5-点位模型 5-Site"]
    end

    subgraph "3-点位 e.g., TIP3P, SPC"
        direction LR
        O1[O qO, LJ] --> H1[H qH]
        O1 --> H2[H qH]
    end
    
    subgraph "4-点位 e.g., TIP4P"
        direction LR
        O2[O LJ] --> H3[H qH]
        O2 --> H4[H qH]
        O2 -- "沿HOH角平分线偏移 Offset along bisector" --> M[M-site qM]
    end

    subgraph "5-点位 e.g., TIP5P"
        direction LR
        O3[O LJ] --> H5[H qH]
        O3 --> H6[H qH]
        O3 -- "模拟孤对电子 Simulate Lone Pairs" --> L1[Lp1 qLp]
        O3 -- "模拟孤对电子 Simulate Lone Pairs" --> L2[Lp2 qLp]
    end

    M3 --> "电荷和LJ中心位于原子核 Charges & LJ on nuclei"];
    M4 --> "负电荷位于虚拟M点 Negative charge on virtual M-site"];
    M5 --> "负电荷分布在两个虚拟孤对电子点 Negative charge on two virtual lone-pair sites"];

    style M3 fill:#cde4ff
    style M4 fill:#d8ffd8
    style M5 fill:#ffebcd
```

### 关键技术规格

下表列出了一些最常用的刚性水模型的几何和势能参数。

| 模型 (Model) | 几何 (Geometry) | r(OH) (Å) | ∠HOH (°) | q(O) (e) | q(H) (e) | $\sigma_{\text{OO}}$ (Å) | $\epsilon_{\text{OO}}$ (kJ/mol) | 备注 (Notes) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **SPC** | 3-点位 | 1.000 | 109.47 | -0.820 | +0.410 | 3.166 | 0.650 | 简单，计算快速，但介电常数偏低。 |
| **SPC/E** | 3-点位 | 1.000 | 109.47 | -0.8476 | +0.4238 | 3.166 | 0.650 | 对SPC进行极化修正，改善了密度和扩散系数。 |
| **TIP3P** | 3-点位 | 0.9572 | 104.52 | -0.834 | +0.417 | 3.1507 | 0.6364 | CHARMM和AMBER力场中的标准水模型。 |
| **TIP4P** | 4-点位 | 0.9572 | 104.52 | 0.0 | +0.520 | 3.1536 | 0.6485 | 负电荷位于M点 (qM = -1.04 e)，O-M距离为0.15 Å。 |
| **TIP4P/2005** | 4-点位 | 0.9572 | 104.52 | 0.0 | +0.5564 | 3.1589 | 0.7749 | 优化了TIP4P，能准确再现水的多种热力学性质。 |
| **TIP5P** | 5-点位 | 0.9572 | 104.52 | 0.0 | +0.241 | 3.120 | 0.7113 | 旨在通过孤对电子更好地描述水的四面体结构。 |

### 常见用例

全原子水模型是研究水溶液中各种现象的基石。
*   **生物分子模拟**: 研究蛋白质折叠、DNA构象变化、配体-受体结合等过程。水的显式表示对于准确捕捉溶剂化效应和氢键网络至关重要。
*   **溶剂化自由能计算**: 通过自由能微扰（FEP）或热力学积分（TI）等方法，计算小分子从气相转移到水相的能量变化，用于药物设计。
*   **界面现象**: 模拟水-空气、水-疏水表面等界面的性质，研究表面张力、接触角等。
*   **晶体成核与生长**: 研究过冷水或溶液中冰晶或其他晶体的形成过程。
*   **电解质溶液**: 研究离子在水中的水合结构、输运性质（如电导率）。

**定量性能指标**: 对于TIP4P/2005模型，在298.15 K和1 bar下，其预测的密度与实验值的偏差小于0.1%，汽化焓偏差小于1%，自扩散系数偏差约为8%。

### 实现考量

在分子动力学模拟软件（如GROMACS, AMBER, NAMD）中实现全原子水模型时，有几个关键的算法考量：

1.  **力计算**: 核心计算任务是在每个时间步长计算每个原子所受的力 $\mathbf{F}_i$，它等于势能 $U$ 对原子坐标 $\mathbf{r}_i$ 的负梯度：
    $$
    \mathbf{F}_i = -\nabla_{\mathbf{r}_i} U(\mathbf{r}^N)
    $$
    对于包含Lennard-Jones和库仑势的成对相互作用，力是直接可导的。

2.  **长程静电作用**: 库仑力是长程力（$1/r$衰减），直接求和在计算上非常昂贵（复杂度为 $O(N^2)$）。现代模拟普遍采用**粒子网格埃瓦尔德 (Particle Mesh Ewald, PME)** 方法来高效计算。
    *   PME将库仑相互作用分为两部分：
        *   **实空间部分**: 短程相互作用，直接在截断半径内计算。
        *   **倒易空间部分**: 长程相互作用，通过将电荷分配到格点上，利用快速傅里叶变换（FFT）在倒易空间中计算。
    *   PME算法的复杂度约为 $O(N \log N)$，极大地提高了模拟大规模体系的效率。

3.  **约束算法**: 对于刚性水模型，需要使用约束算法来固定键长和键角。
    *   **SHAKE**: 一种迭代算法，用于满足距离约束。
    *   **RATTLE**: SHAKE的变体，同时约束位置和速度，与Verlet积分算法兼容性更好。
    *   **LINCS**: 一种非迭代的线性约束求解器，在GROMACS中广泛使用，效率更高。

### 性能特征

下表比较了一些常用模型在标准条件下（298.15 K, 1 atm）对水的一些关键物理性质的预测性能。

| 性质 (Property) | 单位 (Unit) | 实验值 (Exp.) | SPC/E | TIP3P | TIP4P/2005 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 密度 ($\rho$) | g/cm³ | 0.997 | 0.999 | 0.984 | 0.998 |
| 汽化焓 ($\Delta H_{vap}$) | kJ/mol | 44.0 | 46.3 | 42.4 | 44.5 |
| 静态介电常数 ($\epsilon_r$) | - | 78.4 | 68 | 94 | 58 |
| 自扩散系数 ($D$) | 10⁻⁵ cm²/s | 2.30 | 2.49 | 4.90 | 2.11 |
| 等压热容 ($C_p$) | J/mol·K | 75.3 | 77 | 93 | 81.5 |
| 热膨胀系数 ($\alpha_P$) | 10⁻⁴ K⁻¹ | 2.57 | 4.4 | 6.1 | 3.0 |

**统计分析**:
*   **TIP4P/2005** 通常被认为是目前综合性能最好的非极化刚性水模型之一，尤其在预测水的密度、相图和热力学性质方面表现出色。
*   **TIP3P** 和 **SPC** 模型虽然在某些性质上偏差较大（如扩散系数和介电常数），但由于其简单性和计算效率，在许多生物分子模拟中仍被广泛使用。
*   **SPC/E** 是对 **SPC** 的一个重要改进，通过增加平均极化校正，显著改善了密度和扩散系数的预测。

### 相关技术

全原子模型是水模拟的一个层面。根据研究问题对精度和计算成本的不同要求，还存在其他类型的模型。

```mermaid
graph LR
    subgraph "水模型谱系与权衡 Spectrum of Water Models & Trade-offs"
        QM["量子力学/从头算<br>QM/Ab Initio"]
        Pol["可极化全原子<br>Polarizable AA"]
        Fix["固定电荷全原子<br>Fixed-Charge AA"]
        CG["粗粒化<br>Coarse-Grained"]
    end

    QM -- "参数化 Parametrization" --> Pol
    Pol -- "移除极化项 Remove Polarization" --> Fix
    Fix -- "合并原子 Grouping Atoms" --> CG

    subgraph "计算成本 Computational Cost"
        Cost4["极高 Very High["
        Cost3["高 High["
        Cost2["中 Moderate["
        Cost1["低 Low["
    end
    
    subgraph "物理精度 Physical Accuracy"
        Acc1["最高 Highest["
        Acc2["高 High["
        Acc3["中等 Medium["
        Acc4["低 Low["
    end

    QM --- Cost4 & Acc1
    Pol --- Cost3 & Acc2
    Fix --- Cost2 & Acc3
    CG --- Cost1 & Acc4

    style QM fill:#f9f,stroke:#333,stroke-width:2px
    style Pol fill:#ccf,stroke:#333,stroke-width:2px
    style Fix fill:#cfc,stroke:#333,stroke-width:2px
    style CG fill:#fcf,stroke:#333,stroke-width:2px
```

1.  **可极化水模型 (Polarizable Water Models)**:
    *   **概念**: 与固定电荷模型不同，可极化模型允许原子的电荷分布随局域电场的变化而变化。这通过引入诱导偶极或电荷涨落来实现。
    *   **数学模型**: 势能函数中增加了一个极化项 $U_{\text{pol}}$。例如，在诱导偶极模型中：
        $$
        U_{\text{pol}} = - \frac{1}{2} \sum_{i} \boldsymbol{\mu}_{\text{ind}, i} \cdot \mathbf{E}_{0, i}
        $$
        其中，诱导偶极矩 $\boldsymbol{\mu}_{\text{ind}, i}$ 是原子极化率 $\alpha_i$ 和其他原子产生的电场 $\mathbf{E}_{0, i}$ 的函数：
        $$
        \boldsymbol{\mu}_{\text{ind}, i} = \alpha_i \left( \mathbf{E}_{0, i} + \sum_{j \neq i} \mathbf{T}_{ij} \boldsymbol{\mu}_{\text{ind}, j} \right)
        $$
        这个方程需要自洽求解，导致计算成本远高于固定电荷模型。
    *   **优势**: 能够更准确地描述在非均相环境（如气液界面、离子周围）中的静电行为。

2.  **粗粒化水模型 (Coarse-Grained Water Models)**:
    *   **概念**: 为了模拟更大尺度和更长时间的现象，粗粒化模型将多个（通常是4个）水分子合并成一个单一的相互作用中心（“珠子”）。
    *   **数学模型**: 势能函数形式更简单，通常是平滑的Lennard-Jones或类似形式的势，参数经过经验拟合以再现水的宏观性质（如密度和表面张力）。
        $$
        U_{\text{CG}} = \sum_{i<j} U_{\text{eff}}(R_{ij})
        $$
        其中 $R_{ij}$ 是粗粒化珠子之间的距离，$U_{\text{eff}}$ 是一个有效的相互作用势。
    *   **优势**: 计算速度极快，可将模拟尺度扩展到微米和毫秒级别。
    *   **劣势**: 丢失了所有原子尺度的细节，如氢键网络和精确的分子几何。

### 参考文献

1.  Jorgensen, W. L., Chandrasekhar, J., Madura, J. D., Impey, R. W., & Klein, M. L. (1983). Comparison of simple potential functions for simulating liquid water. *The Journal of Chemical Physics*, 79(2), 926–935. **DOI**: [10.1063/1.445869](https://doi.org/10.1063/1.445869) (TIP3P, TIP4P)
2.  Berendsen, H. J. C., Postma, J. P. M., van Gunsteren, W. F., & Hermans, J. (1981). Interaction models for water in relation to protein hydration. In B. Pullman (Ed.), *Intermolecular Forces* (pp. 331–342). Springer Netherlands. **DOI**: [10.1007/978-94-015-7658-1_21](https://doi.org/10.1007/978-94-015-7658-1_21) (SPC)
3.  Berendsen, H. J. C., Grigera, J. R., & Straatsma, T. P. (1987). The missing term in effective pair potentials. *The Journal of Physical Chemistry*, 91(24), 6269–6271. **DOI**: [10.1021/j100308a038](https://doi.org/10.1021/j100308a038) (SPC/E)
4.  Abascal, J. L. F., & Vega, C. (2005). A general purpose model for the condensed phases of water: TIP4P/2005. *The Journal of Chemical Physics*, 123(23), 234505. **DOI**: [10.1063/1.2121687](https://doi.org/10.1063/1.2121687) (TIP4P/2005)
5.  Vega, C., & Abascal, J. L. F. (2011). Simulating water with rigid non-polarizable models: a general perspective. *Physical Chemistry Chemical Physics*, 13(44), 19663-19688. **DOI**: [10.1039/C1CP22168J](https://doi.org/10.1039/C1CP22168J) (Review)