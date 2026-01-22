import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import numpy as np

# 设置现代化风格
plt.style.use('seaborn-v0_8-darkgrid')
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 6), facecolor='#1a1a2e')

# 设置子图背景色
ax1.set_facecolor('#16213e')
ax2.set_facecolor('#16213e')

# ============ 左图：Effectiveness ============
# 数据点
models = {
    'ReasonRank (7B)': (7, 36, 'orange', '*', 300),
    'ReasonRank (32B)': (32, 40, 'orange', '*', 300),
    'Rank-I (7B)': (7, 26, 'lightblue', 'o', 120),
    'Rank-R1 (7B)': (7, 22, 'lightblue', 'o', 120),
    'ReasonIR (8B)': (14, 31, 'gray', 's', 100),
    'Rank-R1 (14B)': (14, 28, 'lightblue', 'o', 120),
    'Rank-I (32B)': (32, 32, 'lightblue', 'o', 120),
    'Rank-K (32B)': (32, 32, 'yellow', 'o', 120),
}

# 绘制数据点
for model, (x, y, color, marker, size) in models.items():
    ax1.scatter(x, y, c=color, marker=marker, s=size, 
                edgecolors='white', linewidths=1.5, alpha=0.9, zorder=3)
    
    # 添加标签（调整位置避免重叠）
    offset_y = 1.5 if 'ReasonRank (7B)' in model else -2
    if 'ReasonRank (32B)' in model:
        offset_x, offset_y = 1, 1
    elif 'Rank-K' in model:
        offset_x, offset_y = 1, 0.5
    else:
        offset_x = 0
    
    ax1.annotate(model, (x, y), xytext=(offset_x, offset_y), 
                textcoords='offset points', fontsize=9, 
                color='#e0e0e0', weight='bold',
                bbox=dict(boxstyle='round,pad=0.3', facecolor='#16213e', 
                         edgecolor='none', alpha=0.7))

# 添加参考线
ax1.axhline(y=31, color='#ff6b6b', linestyle='--', linewidth=1.5, alpha=0.6)

# 设置标签和标题
ax1.set_xlabel('Model Size', fontsize=13, color='#e0e0e0', weight='bold')
ax1.set_ylabel('NDCG@10', fontsize=13, color='#e0e0e0', weight='bold')
ax1.set_title('Effectiveness', fontsize=16, color='#4ecdc4', 
              weight='bold', pad=15)

# 设置刻度
ax1.set_xticks([7, 14, 32])
ax1.set_xticklabels(['7B', '14B', '32B'], color='#e0e0e0', fontsize=11)
ax1.set_ylim(20, 42)
ax1.tick_params(colors='#e0e0e0', labelsize=10)

# 网格样式
ax1.grid(True, alpha=0.2, linestyle='--', linewidth=0.8, color='#4ecdc4')
ax1.spines['top'].set_visible(False)
ax1.spines['right'].set_visible(False)
ax1.spines['left'].set_color('#4ecdc4')
ax1.spines['bottom'].set_color('#4ecdc4')

# ============ 右图：Latency ============
# 数据
models_latency = ['ReasonRank\n(7B)', 'Rank-I\n(7B)']
latencies = [1.8, 4.8]
colors_bar = ['#ff6b6b', '#a8dadc']

# 绘制柱状图
bars = ax2.bar(models_latency, latencies, color=colors_bar, 
               edgecolor='white', linewidth=2, alpha=0.85, width=0.5)

# 添加数值标签
for bar, val in zip(bars, latencies):
    height = bar.get_height()
    ax2.text(bar.get_x() + bar.get_width()/2., height/2,
             f'{val}', ha='center', va='center', 
             fontsize=14, weight='bold', color='white')

# 设置标签和标题
ax2.set_ylabel('Seconds/Query', fontsize=13, color='#e0e0e0', weight='bold')
ax2.set_title('Latency', fontsize=16, color='#4ecdc4', 
              weight='bold', pad=15)
ax2.set_ylim(0, 5.5)
ax2.tick_params(colors='#e0e0e0', labelsize=10)

# 网格和边框
ax2.grid(True, axis='y', alpha=0.2, linestyle='--', linewidth=0.8, color='#4ecdc4')
ax2.spines['top'].set_visible(False)
ax2.spines['right'].set_visible(False)
ax2.spines['left'].set_color('#4ecdc4')
ax2.spines['bottom'].set_color('#4ecdc4')

# 整体标题和说明
fig.suptitle('Model Performance Comparison', 
             fontsize=18, color='#4ecdc4', weight='bold', y=0.98)

plt.figtext(0.5, 0.02, 
            'Figure 1: The left shows the average NDCG@10 on BRIGHT benchmark by reranking ReasonIR-retrieved top-100 passages.\n'
            'The right compares the ranking latency of ReasonRank (7B) and Rank-I (7B) on Earth Science dataset.',
            ha='center', fontsize=10, color='#94a3b8', 
            style='italic', wrap=True)

plt.tight_layout(rect=[0, 0.06, 1, 0.96])
plt.show()