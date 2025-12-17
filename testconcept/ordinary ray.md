## 寻常光 (ordinary ray)

寻常光（ordinary ray），通常简称为o光，是光在各向异性、双折射材料中传播时产生的两个线性偏振分量之一。其行为遵循标准的折射定律，与光在各向同性介质中的传播类似，因此得名“寻常”。这种现象被称为双折射，最早在方解石晶体中被观察到。

### 核心概念与数学基础
在光学各向异性介质中，介电常数 $\epsilon$ 是一个张量，而非标量。这意味着电位移矢量 $\vec{D}$ 不一定与电场矢量 $\vec{E}$ 平行。它们之间的关系由本构关系给出：
$$ D_i = \sum_{j=x,y,z} \epsilon_{ij} E_j \quad \text{或矢量形式,} \quad \vec{D} = \boldsymbol{\epsilon} \vec{E} $$
其中 $\boldsymbol{\epsilon}$ 是介电张量。在主轴坐标系中，该张量是对角化的：
$$ \boldsymbol{\epsilon} = \begin{pmatrix} \epsilon_x & 0 & 0 \\ 0 & \epsilon_y & 0 \\ 0 & 0 & \epsilon_z \end{pmatrix} $$
沿这些轴的折射率定义为 $n_i = \sqrt{\epsilon_i / \epsilon_0}$。

对于单轴晶体（例如方解石、石英），其三个主折射率中有两个是相等的。按照惯例，我们将z轴设为光轴。
$$ n_x = n_y = n_o \quad \text{(寻常光折射率)} $$
$$ n_z = n_e \quad \text{(非寻常光折射率)} $$

当一束非偏振光进入此类晶体时，它会分裂成两个分量：
*   **寻常光 (o-ray):** 该分量的电场矢量振动方向垂直于主平面（由光轴和波传播矢量 $\vec{k}$ 构成的平面）。o光以单一速度 $v_o$ 传播，并经历一个恒定的折射率 $n_o$，无论其传播方向与光轴的夹角如何。
*   **非寻常光 (e-ray):** 该分量的电场矢量振动方向在主平面内。其速度和折射率取决于传播方向。

寻常光的传播具有以下特征：
1.  **波矢量与坡印廷矢量:** 能量流动的方向（由坡印廷矢量 $\vec{S}$ 给出）与波的传播方向（由波矢量 $\vec{k}$ 给出）是共线的。这就是它遵循标准斯涅尔定律的原因。
2.  **惠更斯原理:** 在晶体内部，寻常光的波前是球形的，从点源以速度 $v_o = c/n_o$ 向外扩展。

波传播的基本描述源于麦克斯韦方程组，在无源、非磁性介质中可推导出波动方程：
$$ \nabla \times (\nabla \times \vec{E}) + \mu_0 \boldsymbol{\epsilon} \frac{\partial^2 \vec{E}}{\partial t^2} = 0 $$
对于形式为 $\vec{E}(\vec{r}, t) = \vec{E}_0 e^{i(\vec{k} \cdot \vec{r} - \omega t)}$ 的平面波解，该方程简化为代数方程（菲涅耳波法线方程）：
$$ \frac{k_x^2}{k^2 - k_0^2 n_x^2} + \frac{k_y^2}{k^2 - k_0^2 n_y^2} + \frac{k_z^2}{k^2 - k_0^2 n_z^2} = 0 $$
其中 $k_0 = \omega/c$。对于单轴晶体（$n_x=n_y=n_o, n_z=n_e$），该方程对波矢量的模 $k$ 有两个解：
1.  **寻常解:** $k^2 = k_0^2 n_o^2$。这给出了一个折射率 $n(\hat{s}) = n_o$，它与传播方向 $\hat{s} = \vec{k}/k$ 无关。该解对应于寻常光。
2.  **非寻常解:** $\frac{k_x^2+k_y^2}{k^2 - k_0^2 n_e^2} + \frac{k_z^2}{k^2 - k_0^2 n_o^2} = 0$。其折射率取决于波矢量与光轴之间的夹角 $\theta$。

### 关键技术规格
寻常光的特性由材料的寻常光折射率 $n_o$ 定义。下表为一种常见的双折射材料的规格。

| 属性 | 符号 | 值 (方解石, CaCO$_3$) | 单位 | 注释 |
| :--- | :--- | :--- | :--- | :--- |
| 寻常光折射率 | $n_o$ | 1.65835 | 无量纲 | 在钠D线波长 ($\lambda = 589.3$ nm) 下 |
| 相速度 | $v_o$ | $1.8089 \times 10^8$ | m/s | 计算公式为 $v_o = c/n_o$，其中 $c \approx 2.9979 \times 10^8$ m/s |
| 偏振方向 | $\vec{E}_o$ | 垂直于主平面 | - | 始终与光轴和e光偏振方向正交 |
| 波前形状 | - | 球面 | - | 表明速度在任何方向上都是各向同性的 |
| 色散 ($dn_o/d\lambda$) | - | $\approx -9.6 \times 10^4$ | m$^{-1}$ | 在 $\lambda = 589.3$ nm。$n_o$ 随波长增加而减小 |

### 常见用例
寻常光和非寻常光的分离及其独特性质是许多光学元件工作的基本原理。

*   **偏振器:** 用于产生具有特定偏振态光束的器件。
    *   **格兰-汤普森棱镜:** 使用两块胶合的方解石棱镜。其角度经过精心选择，使得e光透射，而o光在界面处发生全内反射（TIR）并被吸收。
        *   *量化指标:* 消光比通常 > 100,000:1 (50 dB)。
    *   **尼科耳棱镜:** 一种较早的设计，也使用方解石，通过TIR将o光移除。
*   **波片 (相位延迟器):** 通过在o光和e光之间引入特定的相位差来改变光的偏振态的元件。
    *   **半波片 ($\lambda/2$):** 旋转线偏振光的偏振平面。o光和e光之间的光程差为 $(\lambda/2) + m\lambda$。
    *   **四分之一波片 ($\lambda/4$):** 当输入偏振方向与晶体轴成45°角时，可将线偏振光转换为圆偏振光（反之亦然）。
        *   *量化指标:* 相位延迟精度通常优于 $\lambda/500$。
*   **偏振分束器 (例如，渥拉斯顿棱镜):** 这类棱镜将一束输入光分成两束正交偏振的输出光（o光和e光），并以特定角度发散。

### 实现考量
在光学设计软件中，模拟寻常光通过双折射光学系统的路径是一项关键任务。这是一种光线追迹的形式。

**寻常光光线追迹算法:**
1.  **初始化:** 定义入射介质（折射率为 $n_1$）中的初始光线矢量（位置 $\vec{r}_0$ 和方向 $\vec{k}_0$）。
2.  **界面相交:** 计算光线与双折射晶体表面的交点。
3.  **折射计算:**
    *   确定交点处的表面法线 $\hat{n}$。
    *   寻常光的路径使用标准矢量形式的斯涅尔定律计算，将晶体视为折射率为 $n_o$ 的各向同性介质。
    $$ n_1 (\hat{k}_0 \times \hat{n}) = n_o (\hat{k}_o' \times \hat{n}) $$
    o光的折射波矢量 $\vec{k}_o'$ 可通过以下公式求得：
    $$ \vec{k}_o' = \frac{n_1}{n_o} \vec{k}_0 + \left( \sqrt{1 - \left(\frac{n_1}{n_o}\right)^2 (1 - (\vec{k}_0 \cdot \hat{n})^2)} - \frac{n_1}{n_o}(\vec{k}_0 \cdot \hat{n}) \right) \hat{n} $$
4.  **传播:** 沿新方向 $\vec{k}_o'$ 在晶体中传播光线，直至到达下一个界面。
5.  **迭代:** 对所有后续界面重复步骤2-4。

**算法复杂度:**
追迹单条寻常光的计算复杂度为 **O(N)**，其中N是系统中的光学表面（界面）数量。每个界面上的计算是常数时间操作。

### 性能特征
寻常光最显著的性能特征是其**各向同性**。
*   **恒定折射率:** o光所经历的折射率 $n_o$ 与其在晶体内的传播方向无关。这导致了可预测的、简单的折射行为。
*   **恒定相速度:** 相速度 $v_o = c/n_o$ 也是恒定的，从而产生球形波前。
*   **色散:** 寻常光折射率 $n_o$ 是波长 $\lambda$ 的函数。这种关系可以通过塞尔迈耶方程精确建模：
    $$ n_o^2(\lambda) = A_o + \frac{B_{o1} \lambda^2}{\lambda^2 - C_{o1}} + \frac{B_{o2} \lambda^2}{\lambda^2 - C_{o2}} + \dots $$
    其中 $A_o, B_{oi}, C_{oi}$ 是通过实验确定的寻常光塞尔迈耶系数。对于方解石，一种常见的形式是：
    $$ n_o^2(\lambda) = 1 + \sum_{i=1}^{3} \frac{B_i \lambda^2}{\lambda^2 - \lambda_i^2} $$
    *   $B_i, \lambda_i$: 特定于材料的系数。
*   **偏振纯度:** o光是严格的线偏振光，其偏振方向垂直于主平面。在实际元件中，这种偏振的质量通过消光比来衡量，统计上可以超过 $10^5:1$，其标准差取决于制造质量和对准精度。

### 相关技术
寻常光与其对应物——非寻常光密不可分。对两者的比较对于理解其作用至关重要。

```mermaid
graph TD
    subgraph "双折射中的光线 Rays in Birefringence"
        A["入射光 Unpolarized Light"] --> B各向异性晶体 Anisotropic Crystal;
        B --> C["o-光 寻常光 Ordinary Ray"];
        B --> D["e-光 非寻常光 Extraordinary Ray"];
    end

    subgraph "o-光特性 O-Ray Properties"
        C --> C1["偏振 ⊥ 主平面 Polarization ⊥ Principal Plane"];
        C --> C2["折射率 = n_o 恒定 Refractive Index = n_o Constant"];
        C --> C3["波前为球面 Spherical Wavefront"];
        C --> C4["遵循标准斯涅尔定律 Obeys Standard Snell's Law"];
        C --> C5["波矢量 k || 坡印廷矢量 S Wave Vector k || Poynting Vector S"];
    end

    subgraph "e-光特性 E-Ray Properties"
        D --> D1["偏振 // 主平面 Polarization // Principal Plane"];
        D --> D2["折射率 n_eθ 随方向变化 Refractive Index n_eθ Varies with direction"];
        D --> D3["波前为椭球面 Ellipsoidal Wavefront"];
        D --> D4["不遵循标准斯涅尔定律 Violates Standard Snell's Law"];
        D --> D5["波矢量 k 与 坡印廷矢量 S 通常不平行 Wave Vector k and Poynting Vector S generally not parallel"];
    end

    style C fill:#ccf,stroke:#333,stroke-width:2px
    style D fill:#fcc,stroke:#333,stroke-width:2px
```

**比较数学模型:**

| 特征 | 寻常光 (o-ray) | 非寻常光 (e-ray) |
| :--- | :--- | :--- |
| **折射率** | $n = n_o$ (恒定) | $\frac{1}{n_e^2(\theta)} = \frac{\cos^2\theta}{n_o^2} + \frac{\sin^2\theta}{n_e^2}$，其中 $\theta$ 是波矢量 $\vec{k}$ 与光轴之间的夹角。 |
| **折射率椭球** | 对应于折射率椭球的圆形截面，其半径恒为 $n_o$。 | 对应于折射率椭球的椭圆截面，其半轴长度从 $n_o$ (当 $\vec{k}$ 沿光轴) 变化到 $n_e$ (当 $\vec{k}$ 垂直于光轴)。 |
| **相速度** | $v_p = v_o = c/n_o$ (恒定) | $v_p(\theta) = c/n_e(\theta)$ (与方向相关) |
| **光线速度** | $v_r = v_p = v_o$ (能量流与波传播方向共线) | $v_r(\theta')$ 通常与 $v_p(\theta)$ 不同，且除沿主轴方向外，与 $\vec{k}$ 不共线。$\theta'$ 是光线矢量 $\vec{S}$ 与光轴的夹角。 |
| **电场矢量** | $\vec{E}_o$ 垂直于光轴。$\vec{D}_o = \epsilon_0 n_o^2 \vec{E}_o$。 | $\vec{E}_e$ 位于主平面内。$\vec{D}_e$ 也位于主平面内，但通常不与 $\vec{E}_e$ 平行。 |

### 参考文献
1.  Born, M., & Wolf, E. (1999). *Principles of Optics: Electromagnetic Theory of Propagation, Interference and Diffraction of Light* (7th ed.). Cambridge: Cambridge University Press. (这是一本基础性著作，在第15章中涵盖了该主题)。
2.  Saleh, B. E. A., & Teich, M. C. (2019). *Fundamentals of Photonics* (3rd ed.). Wiley. DOI: [10.1002/9781119506874](https://doi.org/10.1002/9781119506874) (第6章对各向异性介质中的波传播进行了全面处理)。
3.  Yariv, A., & Yeh, P. (2007). *Photonics: Optical Electronics in Modern Communications* (6th ed.). Oxford University Press. (第4章讨论了光在各向异性晶体中的传播和折射率椭球)。