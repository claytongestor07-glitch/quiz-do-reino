# Roda na GPU gratuita do Kaggle (workflow kenji-referencias.yml com script=kenji_lipsync).
# Kenji Studio — sincronia labial com o LatentSync 1.5 (ByteDance, Apache 2.0).
# env: CHAVES=ep001, PARES=clipe:fala,clipe:fala (clipe em kenji/<ep>/clipes/<clipe>.mp4, fala em kenji/<ep>/vozes/<fala>.wav)
# Saída: /kaggle/working/<clipe>-ls.mp4 com a duração da fala (o vídeo vai e volta quando a fala é mais longa).
import os, subprocess, sys
from urllib.request import urlretrieve

RAW = 'https://raw.githubusercontent.com/claytongestor07-glitch/quiz-do-reino/main/kenji/'
EP = os.environ.get('CHAVES', 'ep001')
PARES = [p.split(':') for p in os.environ.get('PARES', '').split(',') if ':' in p]
W = '/kaggle/working'
def sh(c, **k): print('$', c, flush=True); return subprocess.run(c, shell=True, **k)

sh('git clone -q https://github.com/bytedance/LatentSync.git /kaggle/ls', check=True)
os.chdir('/kaggle/ls')
sh(f'{sys.executable} -m pip install -q -r requirements.txt', check=True)
sh('apt-get -qq install -y libgl1 > /dev/null 2>&1 || true')
sh(f'{sys.executable} -c "from huggingface_hub import hf_hub_download as d; '
	"d('ByteDance/LatentSync-1.5','latentsync_unet.pt',local_dir='checkpoints'); "
	"d('ByteDance/LatentSync-1.5','whisper/tiny.pt',local_dir='checkpoints')\"", check=True)
cfg = 'configs/unet/stage2.yaml' if os.path.exists('configs/unet/stage2.yaml') else sorted(
	f'configs/unet/{f}' for f in os.listdir('configs/unet') if f.startswith('stage2'))[0]
print('config', cfg, flush=True)
os.makedirs('/kaggle/in', exist_ok=True)
for clipe, fala in PARES:
	v, a = f'/kaggle/in/{clipe}.mp4', f'/kaggle/in/{fala}.wav'
	urlretrieve(f'{RAW}{EP}/clipes/{clipe}.mp4', v); urlretrieve(f'{RAW}{EP}/vozes/{fala}.wav', a)
	# 25 fps, como o LatentSync espera
	sh(f'ffmpeg -v error -y -i {v} -r 25 -c:v libx264 -crf 14 /kaggle/in/{clipe}-25.mp4', check=True)
	r = sh(f'{sys.executable} -m scripts.inference --unet_config_path {cfg} --inference_ckpt_path checkpoints/latentsync_unet.pt '
		f'--inference_steps 25 --guidance_scale 1.5 --video_path /kaggle/in/{clipe}-25.mp4 --audio_path {a} '
		f'--video_out_path {W}/{clipe}-ls.mp4')
	print(f'{clipe}: {"ok" if r.returncode == 0 and os.path.exists(f"{W}/{clipe}-ls.mp4") else "FALHOU"}', flush=True)
print('fim', flush=True)
