-- 담당자에게 개별로 부여 가능한 "이미지 다운로드" 권한 추가.
-- 고객 팝업의 [이미지 저장] 버튼을 이 권한이 있는 사용자에게만 노출.

ALTER TABLE "users" ADD COLUMN "can_download_image" boolean DEFAULT false NOT NULL;
