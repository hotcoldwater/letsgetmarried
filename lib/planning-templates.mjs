// Short, optional starting points distilled from the user's references.
// Never import sample prices, vendors, guests or dates as the couple's records.
export const decisionTemplates = [
  { id: 'venue', title: '예식장과 보증 인원 정하기', group: '예식장', hint: '대관료, 식대, 보증 인원, 취소 조건을 함께 확인해요.' },
  { id: 'planning', title: '플래너 이용 여부 정하기', group: '예식장', hint: '직접 준비할 범위와 도움받을 범위를 정해요.' },
  { id: 'package', title: '스드메 패키지 또는 개별 업체 정하기', group: '스튜디오 · 드레스 · 메이크업', hint: '패키지 포함 항목과 별도 추가금을 비교해요.' },
  { id: 'studio', title: '스튜디오와 촬영 분위기 정하기', group: '스튜디오 · 드레스 · 메이크업', hint: '촬영 시간, 원본, 수정본, 앨범 포함 여부를 확인해요.' },
  { id: 'dress', title: '드레스와 피팅 일정 정하기', group: '스튜디오 · 드레스 · 메이크업', hint: '피팅비, 드레스 추가금, 헬퍼 비용을 확인해요.' },
  { id: 'makeup', title: '메이크업과 헤어 정하기', group: '스튜디오 · 드레스 · 메이크업', hint: '촬영일과 본식의 시작 시간, 헤어 변형 여부를 확인해요.' },
  { id: 'rings', title: '결혼반지와 예복 정하기', group: '예복 · 예물', hint: '주문부터 수령까지 필요한 기간을 확인해요.' },
  { id: 'parents', title: '혼주 의상과 메이크업 예약하기', group: '혼주', hint: '의상 수령일, 미용실 방문 시간, 준비물을 확인해요.' },
  { id: 'photo', title: '본식 사진과 영상 업체 정하기', group: '본식 준비', hint: '촬영 범위, 작가 수, 결과물과 전달 일정을 확인해요.' },
  { id: 'invitation', title: '청첩장 디자인과 수량 정하기', group: '청첩장', hint: '인쇄 수량, 문구, 모바일 청첩장 정보를 확인해요.' },
  { id: 'host', title: '사회자와 축가 부탁하기', group: '본식 준비', hint: '담당자, 연락처, 사례비, 도착 시간을 정해요.' },
  { id: 'ceremony', title: '식순·서약서·음원·영상 준비하기', group: '본식 준비', hint: '예식장 제출 기한과 파일 형식을 확인하고 재생을 점검해요.' },
  { id: 'flowers', title: '부케와 답례품 정하기', group: '본식 준비', hint: '수령 방법과 전달 담당자를 정해요.' },
  { id: 'reception', title: '축의대 담당자와 인계 방법 정하기', group: '본식 준비', hint: '봉투 수령, 장부 작성, 식권 안내, 보관·정산 담당을 나눠요.' },
  { id: 'guests', title: '최종 하객 수와 식대 확인하기', group: '예식장', hint: '보증 인원 변경 기한과 식권·주차 안내를 확인해요.' },
  { id: 'honeymoon', title: '신혼여행 예약과 준비물 확인하기', group: '신혼여행', hint: '여권, 항공편, 숙소, 출발 일정을 확인해요.' },
];
export const checklistTemplates = [
  { id: 'fitting', title: '드레스 피팅', tasks: ['피팅 시간과 위치 확인', '원하는 드레스 사진 준비', '이너웨어와 신발 준비', '피팅비와 추가금 확인'] },
  { id: 'before', title: '본식 전날', tasks: ['반지와 반지 케이스 챙기기', '신랑 예복·구두·긴 양말 준비', '신부 드레스 소품·슈즈·이너 준비', '혼주 의상과 장신구 확인', '식순 문서와 음원·영상 백업 준비', '현금 봉투와 담당자별 준비물 나누기', '충전기·보조배터리·비상용품 챙기기'] },
  { id: 'arrival', title: '본식 당일', tasks: ['예식장 담당자와 식순·입장 동선 확인', '음원과 영상 재생 확인', '반지·부케 전달 담당 확인', '축의대·식권·주차 안내 확인', '혼주와 사진 촬영 순서 확인', '개인 소지품 맡기고 휴대폰 무음 설정'] },
  { id: 'after', title: '예식 후', tasks: ['축의금과 장부 인계받기', '예식장 잔금·추가금 확인', '대여 의상과 소품 반납', '개인 소지품과 분실물 확인', '도움 주신 분들께 감사 인사'] },
];
