import matplotlib.pyplot as plt
import neurokit2 as nk

signal = nk.signal_simulate(duration=2, sampling_rate=200, frequency=[5, 6], noise=0.5)
nk.complexity_hurst(signal, corrected=True, show=True)

fig = plt.gcf()
fig.set_size_inches(10, 6, forward=True)
fig.savefig("featured.png", dpi=300, facecolor='w')
