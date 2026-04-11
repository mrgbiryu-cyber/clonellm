**Visual Alignment**
목적:
- `reference-content`
- `clone`
- `compare`
를 동일 캔버스에서 이미지로 저장하고, slot snapshot / diff와 함께 검토한다.

구성:
1. `reference`
   - 원본 snapshot 기준 화면
2. `working`
   - 현재 clone shell 포함 작업본
3. `compare`
   - 좌우 비교 화면

실행:
```bash
cd /mnt/c/Users/mrgbi/lge-site-analysis
python3 scripts/capture_visual_snapshots.py home
```

출력:
- `data/visual/home/reference.png`
- `data/visual/home/working.png`
- `data/visual/home/compare.png`
- `data/visual/home/metadata.json`

활용:
1. 헤더, 히어로, 퀵메뉴 시각 차이 확인
2. slot snapshot과 screenshot을 함께 보고 구조/스타일 차이 분리
3. 이후 Figma/custom slot replacement 비교 기준으로 재사용
