@echo off
echo ======================================================
echo    CONG CU UPLOAD PHAN MEM GOMITA LEN GITHUB
echo ======================================================
echo.

:: Kiem tra xem Git da duoc cai dat chua
where git >nul 2>nul
if %errorlevel% neq 0 (
    echo [LOI] May tinh cua ban chua duoc cai dat phan mem Git!
    echo.
    echo Vui long tai va cai dat Git tu duong link chinh thuc sau:
    echo --^> https://git-scm.com/download/win
    echo.
    echo [Sau khi cai dat xong, hay mo lai cua so nay de chay nhe]
    echo.
    pause
    exit /b
)

:: Khai bao safe directory de tranh loi dubious ownership cua Git
git config --global --add safe.directory "%cd:\=/%" >nul 2>nul

:: Khai bao danh tinh Git neu chua co de tranh loi commit
git config user.email >nul 2>nul
if %errorlevel% neq 0 (
    echo Thiet lap danh tinh mac dinh cho Git...
    git config --global user.email "gomita-developer@example.com"
    git config --global user.name "Gomita Developer"
)

:: Khoi tao Git repository neu chua co
if not exist .git (
    echo Khoi tao Git repository cuc bo...
    git init
    git branch -M main
)

:: Them toan bo file vao git staging
echo.
echo Dang them toan bo file du an [loai tru node_modules, .next]...
git add .

:: Commit cac file
echo.
echo Dang luu tru phien ban code hien tai [commit]...
git commit -m "Initial commit - GOMITA Company Management Web App"

:: Hoi nguoi dung nhap link GitHub repository
echo.
echo ======================================================
echo HUONG DAN TAO REPOSITORY TREN GITHUB:
echo 1. Truy cap https://github.com va dang nhap.
echo 2. Nhan nut "New" de tao repository moi.
echo 3. Nhap ten repository, vi du: gomita-quan-ly-cong-ty
echo 4. Nhan "Create repository" [Khong tich bat ky checkbox nao]
echo 5. Copy link repository cua ban, co dang: https://github.com/username/repo.git
echo ======================================================
echo.
set /p REPO_URL="Nhap link repository GitHub cua ban: "

if "%REPO_URL%"=="" (
    echo [LOI] Link repository khong duoc de trong!
    pause
    exit /b
)

:: Xoa remote cu neu co va them remote moi
git remote remove origin >nul 2>nul
git remote add origin %REPO_URL%

:: Push code len GitHub
echo.
echo Dang tai code len GitHub nhanh main...
echo [Co the co mot cua so nho hien len yeu cau ban dang nhap Github]
git push -u origin main

echo.
echo ======================================================
echo CHUC MUNG! DA UPLOAD DU AN LEN GITHUB THANH CONG!
echo ======================================================
echo.
pause
