## s 偏振

s 偏振（s-polarization）是电磁波偏振态的一种，其定义与电磁波和两种不同介质的界面相互作用相关。具体来说，当一束电磁波（如光波）入射到界面上时，我们可以定义一个“入射面”，该平面由入射波的传播方向（波矢）和界面法线共同构成。如果电磁波的电场矢量垂直于这个入射面，则称其为 s 偏振。

“s”源于德语单词“senkrecht”，意为“垂直”。s 偏振也被称为**横电波**（Transverse Electric, TE wave），因为其电场矢量（E-field）横向于入射面。

### 核心概念与数学基础

考虑一个位于 $z=0$ 平面的两种各向同性、非磁性、均匀介质的界面。介质1 ($z<0$) 的折射率为 $n_1$，介质2 ($z>0$) 的折射率为 $n_2$。入射面被定义为 xz-平面。

根据定义，s 偏振波的电场矢量 $\vec{E}$ 完全在 y 方向上。

```mermaid
graph TD
    subgraph "s 偏振几何结构 s-polarization Geometry"
        direction LR
        A["入射波 Incident Wave"] --> B界面 Interface;
        B --> C["反射波 Reflected Wave"];
        B --> D["折射波 Transmitted/Refracted Wave"];

        subgraph "入射面 Plane of Incidence - xz平面"
            direction TB
            k_i[入射波矢 k_i] --> InterfacePoint;
            k_r[反射波矢 k_r] --> InterfacePoint;
            k_t[折射波矢 k_t] --> InterfacePoint;
            Normal["法线 Normal z-axis"] -- "垂直于界面" --> InterfacePoint;
        end

        subgraph "电场矢量 E-field Vector"
            E_s["E_s 垂直于入射面<br>Perpendicular to Plane of Incidence"]
        end

        A -- "包含 Contains k_i & E_s" --> E_s;
        E_s -- "方向: <b>y-axis</b>" --> Note1["s 来自德语 'senkrecht'<br>perpendicular"];
    end

    style E_s fill:#f9f,stroke:#333,stroke-width:2px
```

#### 1. s 偏振波的数学描述

一束频率为 $\omega$ 的 s 偏振平面电磁波可以表示如下：

- **入射波 (Incident Wave)**:
$$ \vec{E}_i(\vec{r}, t) = E_{0,i} \hat{y} e^{i(\vec{k}_i \cdot \vec{r} - \omega t)} $$
$$ \vec{H}_i(\vec{r}, t) = \frac{1}{\mu_1 \omega} (\vec{k}_i \times \vec{E}_i) = \frac{k_1}{\mu_1 \omega} E_{0,i} (-\cos\theta_i \hat{x} + \sin\theta_i \hat{z}) e^{i(\vec{k}_i \cdot \vec{r} - \omega t)} $$
其中，波矢 $\vec{k}_i = k_1 (\sin\theta_i \hat{x} + \cos\theta_i \hat{z})$。

- **反射波 (Reflected Wave)**:
$$ \vec{E}_r(\vec{r}, t) = E_{0,r} \hat{y} e^{i(\vec{k}_r \cdot \vec{r} - \omega t)} $$
其中，波矢 $\vec{k}_r = k_1 (\sin\theta_i \hat{x} - \cos\theta_i \hat{z})$。

- **透射波 (Transmitted Wave)**:
$$ \vec{E}_t(\vec{r}, t) = E_{0,t} \hat{y} e^{i(\vec{k}_t \cdot \vec{r} - \omega t)} $$
其中，波矢 $\vec{k}_t = k_2 (\sin\theta_t \hat{x} + \cos\theta_t \hat{z})$。

**参数定义**:
*   $\vec{E}$: 电场矢量 (V/m)
*   $\vec{H}$: 磁场强度矢量 (A/m)
*   $E_0$: 电场振幅 (V/m)
*   $\hat{x}, \hat{y}, \hat{z}$: 笛卡尔坐标系的单位矢量
*   $\vec{k}$: 波矢，其大小 $k = \frac{2\pi n}{\lambda_0} = \frac{n\omega}{c}$
*   $\vec{r}$: 位置矢量
*   $\omega$: 角频率 (rad/s)
*   $t$: 时间 (s)
*   $\mu_1$: 介质1的磁导率 (H/m)
*   $\theta_i$: 入射角
*   $\theta_r$: 反射角 ($\theta_r = \theta_i$)
*   $\theta_t$: 折射角，由斯涅尔定律决定：$n_1 \sin\theta_i = n_2 \sin\theta_t$

#### 2. 菲涅尔方程 (Fresnel Equations) for s-polarization

菲涅尔方程描述了在界面上电磁波的反射和透射振幅。它们通过在界面 ($z=0$) 处应用电磁场的边界条件（切向分量连续）推导得出。

对于 s 偏振，电场 $\vec{E}$ 和磁场 $\vec{H}$ 的切向分量（y 和 x 分量）必须连续：
1.  $E_{i,y} + E_{r,y} = E_{t,y} \implies E_{0,i} + E_{0,r} = E_{0,t}$
2.  $H_{i,x} + H_{r,x} = H_{t,x} \implies -\frac{n_1}{\mu_1 c}E_{0,i}\cos\theta_i + \frac{n_1}{\mu_1 c}E_{0,r}\cos\theta_i = -\frac{n_2}{\mu_2 c}E_{0,t}\cos\theta_t$

对于非磁性介质 ($\mu_1 \approx \mu_2 \approx \mu_0$)，解这两个方程可得到振幅反射系数 ($r_s$) 和振幅透射系数 ($t_s$)：

$$ r_s = \frac{E_{0,r}}{E_{0,i}} = \frac{n_1 \cos\theta_i - n_2 \cos\theta_t}{n_1 \cos\theta_i + n_2 \cos\theta_t} $$

$$ t_s = \frac{E_{0,t}}{E_{0,i}} = \frac{2 n_1 \cos\theta_i}{n_1 \cos\theta_i + n_2 \cos\theta_t} $$

能量的反射率 ($R_s$) 和透射率 ($T_s$) 是振幅系数的模平方（考虑了波阻抗和传播方向）：

$$ R_s = |r_s|^2 = \left| \frac{n_1 \cos\theta_i - n_2 \cos\theta_t}{n_1 \cos\theta_i + n_2 \cos\theta_t} \right|^2 $$

$$ T_s = \frac{n_2 \cos\theta_t}{n_1 \cos\theta_i} |t_s|^2 $$

根据能量守恒定律，$R_s + T_s = 1$。

### 关键技术规格

s 偏振的特性可以通过以下参数量化，这些参数在光学设计和分析中至关重要。

| 参数 (Parameter) | 符号 (Symbol) | 定义 (Definition) | 典型值/范围 (Typical Value/Range) | 单位 (Units) |
| :--- | :--- | :--- | :--- | :--- |
| 振幅反射系数 | $r_s$ | 反射波与入射波的电场振幅之比 | -1 to +1 | 无量纲 |
| 振幅透射系数 | $t_s$ | 透射波与入射波的电场振幅之比 | 0 to 2 | 无量纲 |
| 反射率 | $R_s$ | 反射波能量与入射波能量之比 ($|r_s|^2$) | 0 to 1 | 无量纲或 % |
| 透射率 | $T_s$ | 透射波能量与入射波能量之比 | 0 to 1 | 无量纲或 % |
| 相位移 | $\delta_s$ | 反射或透射时引入的相位变化 (arg($r_s$)) | 0 or $\pi$ (对于介电材料) | 弧度 (rad) or 度 (deg) |
| 消光比 (Polarizer) | ER | 偏振器件透射所需偏振与抑制偏振的功率比 | > 1000:1 (30 dB) | 比率或 dB |

### 常见用例与性能指标

s 偏振的独特性质使其在多种光学技术中得到广泛应用。

*   **介质反射镜 (Dielectric Mirrors)**
    *   **描述**: 通过交替堆叠高、低折射率的介质薄膜（1/4波长厚度）来制造高反射率反射镜。对于给定的入射角，s 偏振的反射率通常高于 p 偏振，因此更容易实现高反射。
    *   **性能指标**: 在设计波段和角度范围内，$R_s > 99.99\%$。例如，一个用于 1064 nm 激光、45° 入射角的反射镜，其 $R_s$ 可达 99.95%，而 $R_p$ 可能只有 99.5%。

*   **偏振分束器 (Polarizing Beamsplitters)**
    *   **描述**: 这类器件利用 s 偏振和 p 偏振在特定角度（通常是布儒斯特角附近）反射率的巨大差异。一个典型的立方体偏振分束器被设计用来高效反射 s 偏振光，同时高效透射 p 偏振光。
    *   **性能指标**:
        *   s 偏振反射率: $R_s > 99.5\%$
        *   p 偏振透射率: $T_p > 95\%$
        *   消光比: $T_p/T_s > 1000:1$

*   **椭圆偏振法 (Ellipsometry)**
    *   **描述**: 一种高度灵敏的计量技术，通过测量光在样品表面反射后偏振态的变化来表征薄膜厚度、光学常数等。它测量的核心是 $r_p$ 和 $r_s$ 的比值。
    *   **性能指标**: 厚度测量精度可达 ±0.01 nm。测量的物理量 $\Psi$ 和 $\Delta$ 定义为 $\tan(\Psi)e^{i\Delta} = \frac{r_p}{r_s}$。s 偏振的响应是计算这些参数的基准。

### 实现考量：多层膜光学模型

在实际应用中，光学元件通常包含多层薄膜。计算这种复杂结构对 s 偏振光的响应需要使用**传输矩阵法 (Transfer Matrix Method, TMM)**。

#### 1. 算法描述
对于 s 偏振，每一层介质 $j$（厚度为 $d_j$，折射率为 $n_j$）可以用一个 2x2 的特征矩阵 $M_j$ 来描述：

$$ M_j = \begin{pmatrix} \cos(\beta_j) & \frac{-i}{\eta_j} \sin(\beta_j) \\ -i\eta_j \sin(\beta_j) & \cos(\beta_j) \end{pmatrix} $$

其中：
*   $\beta_j = \frac{2\pi}{\lambda_0} n_j d_j \cos\theta_j$ 是层内的相位厚度。
*   $\theta_j$ 是光在该层中的传播角度，由斯涅尔定律递归计算。
*   $\eta_j = n_j \cos\theta_j$ 是 s 偏振的有效光学导纳。

一个由 $N$ 层薄膜组成的系统，其总传输矩阵 $M$ 是各层矩阵的乘积：

$$ M = M_1 M_2 \cdots M_N = \begin{pmatrix} m_{11} & m_{12} \\ m_{21} & m_{22} \end{pmatrix} $$

整个系统的振幅反射系数 $r_s$ 和透射系数 $t_s$ 可以由总矩阵的元素和入射/出射介质的导纳（$\eta_0$ 和 $\eta_s$）计算得出：

$$ r_s = \frac{(\eta_0 m_{11} + \eta_0 \eta_s m_{12}) - (m_{21} + \eta_s m_{22})}{(\eta_0 m_{11} + \eta_0 \eta_s m_{12}) + (m_{21} + \eta_s m_{22})} $$

$$ t_s = \frac{2\eta_0}{(\eta_0 m_{11} + \eta_0 \eta_s m_{12}) + (m_{21} + \eta_s m_{22})} $$

#### 2. 算法复杂度分析
对于一个包含 $N$ 层的薄膜系统，计算总传输矩阵需要进行 $N-1$ 次 2x2 矩阵乘法。每次矩阵乘法需要 8 次乘法和 4 次加法。因此，该算法的计算复杂度为 **$O(N)$**，这使得它在计算上非常高效，能够快速分析和优化复杂的光学涂层。

### 性能特征与统计度量

s 偏振反射率 $R_s$ 对各种物理参数的变化非常敏感，这种敏感性既是测量的基础，也是设计中需要考虑的公差来源。

*   **对入射角的敏感度**:
    对于从低折射率介质到高折射率介质的外部反射（例如空气到玻璃），$R_s$ 随入射角 $\theta_i$ 的增加而单调增加。在掠入射角（$\theta_i \to 90^\circ$）时，$R_s \to 1$。这种可预测的行为与 p 偏振在布儒斯特角处反射率为零形成鲜明对比。

*   **统计分析示例**:
    假设使用椭圆偏振法测量硅基板上的 SiO₂ 薄膜厚度。测量数据为一系列波长下的 $(\Psi, \Delta)$ 值。通过 TMM 模型对实验数据进行最小二乘法拟合，可以提取厚度 $d$ 和折射率 $n(\lambda)$。
    *   **结果报告**: 拟合结果通常表示为最佳值及 95% 置信区间，例如：厚度 $d = 50.23 \pm 0.05$ nm。
    *   **不确定性来源**: 测量噪声、入射角的不确定性 ($\pm 0.01^\circ$)、光源波长的漂移等都会影响最终结果的精度。$R_s$ 的稳定性是保证测量精度的关键因素之一。

### 相关技术与数学模型比较

s 偏振最直接的对应是 p 偏振。理解它们的差异是偏振光学的基础。

```mermaid
graph TD
    subgraph "电磁波偏振态 Polarization States of EM Waves"
        A[非偏振光<br>Unpolarized Light] --> B偏振器<br>Polarizer;
        B --> C[偏振光<br>Polarized Light];

        C --> D[线偏振<br>Linear Polarization];
        C --> E[圆偏振<br>Circular Polarization];
        C --> F[椭圆偏振<br>Elliptical Polarization];

        D --> s_pol["<b>s 偏振 TE</b><br>E ⊥ 入射面"];
        D --> p_pol["<b>p 偏振 TM</b><br>E || 入射面"];

        s_pol -- "与 p 偏振相移90°叠加<br>Superposition with p-pol 90° phase shift" --> E;
        s_pol -- "与 p 偏振任意相移/振幅叠加<br>Superposition with p-pol general phase/amplitude" --> F;
        p_pol -- "与 s 偏振相移90°叠加<br>Superposition with s-pol 90° phase shift" --> E;
        p_pol -- "与 p 偏振任意相移/振幅叠加<br>Superposition with p-pol general phase/amplitude" --> F;

        Note["s 和 p 偏振是描述线偏振光<br>在界面相互作用时的基本正交基矢<br>s and p are orthogonal bases for linear polarization at an interface"];
        s_pol --> Note;
        p_pol --> Note;
    end

    style s_pol fill:#ccf,stroke:#333,stroke-width:4px
    style p_pol fill:#cfc,stroke:#333,stroke-width:2px
```

#### 比较：s 偏振 vs. p 偏振

| 特性 (Feature) | s 偏振 (TE) | p 偏振 (TM) |
| :--- | :--- | :--- |
| **电场方向** | 垂直于入射面 | 平行于入射面 |
| **反射系数** | $r_s = \frac{n_1 \cos\theta_i - n_2 \cos\theta_t}{n_1 \cos\theta_i + n_2 \cos\theta_t}$ | $r_p = \frac{n_2 \cos\theta_i - n_1 \cos\theta_t}{n_2 \cos\theta_i + n_1 \cos\theta_t}$ |
| **布儒斯特角** | **不存在**。$R_s$ 随 $\theta_i$ 单调增加（对于 $n_1<n_2$）。 | **存在**。当 $\theta_i = \theta_B$ 时，$R_p=0$。 |
| **布儒斯特角条件** | N/A | $\theta_B = \arctan\left(\frac{n_2}{n_1}\right)$ |
| **全内反射相位** | $\tan\left(\frac{\delta_s}{2}\right) = \frac{\sqrt{n_1^2 \sin^2\theta_i - n_2^2}}{n_1 \cos\theta_i}$ | $\tan\left(\frac{\delta_p}{2}\right) = \frac{n_1^2 \sqrt{n_1^2 \sin^2\theta_i - n_2^2}}{n_2^2 n_1 \cos\theta_i}$ |

**关键区别**: p 偏振存在一个特殊的入射角——布儒斯特角 $\theta_B$，在此角度入射时，p 偏振光完全透射，没有反射（$R_p=0$）。而对于 s 偏振，在任何入射角下（除 $\theta_i=0$ 的特殊情况外），反射率 $R_s$ 总是大于零。这一根本差异是偏振分束器等许多光学器件的设计基础。

### 参考文献

1.  Born, M., & Wolf, E. (1999). *Principles of Optics: Electromagnetic Theory of Propagation, Interference and Diffraction of Light* (7th ed.). Cambridge University Press. (This is a foundational text covering all aspects of physical optics, including detailed derivations of Fresnel equations).
2.  Hecht, E. (2017). *Optics* (5th ed.). Pearson. (A widely used undergraduate and graduate textbook with clear explanations of polarization phenomena).
3.  Azzam, R. M. A., & Bashara, N. M. (1987). *Ellipsometry and Polarized Light*. North-Holland. DOI: [10.1016/C2009-0-21286-3](https://doi.org/10.1016/C2009-0-21286-3). (The definitive reference on the theory and application of ellipsometry, which relies heavily on the s- and p-polarization formalism).
4.  Macleod, H. A. (2010). *Thin-Film Optical Filters* (4th ed.). CRC Press. DOI: [10.1201/9781420073034](https://doi.org/10.1201/9781420073034). (Provides comprehensive coverage of the Transfer Matrix Method and its application to optical coatings for both s- and p-polarization).