// 5일 일정 자료.
// - 좌표: 공개 지도 기준 대략 위치입니다. `npm run data` 실행 시 OSM 이름과 대조해
//   오차가 크면 public/data/day-N.json의 placeChecks에 기록되고, 앱이 OSM 좌표로 보정합니다.
// - 운영 정보: verified=true 항목만 공식(또는 공공기관) 자료로 확인한 내용입니다.
//   나머지는 "확인 필요"로 표시합니다. (확인일: 2026-10-10)
// - 예약: 이 일정의 어떤 항목도 예약되어 있지 않습니다.

export type Booking = 'none' | 'recommended' | 'online-sales';

export interface Source {
  label: string;
  url: string;
}

export interface Place {
  id: string;
  time: string;
  name: string;
  local: string;
  lng: number;
  lat: number;
  /** 건물 크기에 맞춘 확대 비율 */
  zoom: number;
  /** 상세 건물 수집 반경(m) */
  radius?: number;
  kind: 'sight' | 'food' | 'rest';
  desc: string;
  hours: { text: string; verified: boolean; source?: Source };
  /** 정기 휴무 요일 (0=일 … 6=토) */
  closedDays?: number[];
  booking: Booking;
  bookingNote?: string;
  /** OSM 이름 대조용 정규식 (scripts/fetch-osm.ts) */
  osmName?: string;
}

export interface Day {
  id: number;
  title: string;
  area: string;
  summary: string;
  places: Place[];
  move: string;
  eat: string;
  reserve: string;
  rain: string;
}

const NTM: Source = {
  label: 'Taipei Times (2021) · 국립대만박물관 안내',
  url: 'https://www.taipeitimes.com/News/feat/archives/2021/03/19/2003754096',
};
const NRM: Source = {
  label: '국가철도박물관 공식 FAQ',
  url: 'https://www.nrm.gov.tw/News_Toggle.aspx?n=3361&sms=13224',
};
const HOTSPRING: Source = {
  label: '베이터우 온천박물관 공식 학습 수첩(PDF)',
  url: 'https://hotspringmuseum.taipei/',
};

export const TRIP = {
  title: 'Taipei',
  subtitle: '다섯 날의 골목 수첩',
  period: '5일 · 출발일 미정',
  note: '도착일 오후 시작, 마지막 날 오후 출국을 가정한 일정입니다.',
};

export const DAYS: Day[] = [
  {
    id: 1,
    title: '북문 근처 붉은 벽돌의 오후',
    area: '중정구 · 다다오청',
    summary:
      '공항에서 시내로 들어와 짐을 맡긴 뒤, 걸어서 닿는 거리에 모인 근대 건축을 천천히 봅니다. 해 질 녘에는 강변으로 나가고, 저녁은 관광객이 적은 동네 야시장에서.',
    places: [
      {
        id: 'd1-railway-dept',
        time: '14:30',
        name: '국립대만박물관 철도부 원구',
        local: '國立臺灣博物館 鐵道部園區',
        lng: 121.51137,
        lat: 25.04926,
        zoom: 17.6,
        radius: 380,
        kind: 'sight',
        desc: '1920년 완공된 옛 철도부 청사와 부속 건물 군. 붉은 벽돌과 목조 회랑, 중정 구조를 지도에서 함께 확인하기 좋습니다.',
        hours: { text: '화–일 09:30–17:00 · 월 휴관 · 유료 입장', verified: true, source: NTM },
        closedDays: [1],
        booking: 'none',
        bookingNote: '현장 매표. 현재 요금은 방문 전 확인 필요.',
        osmName: '鐵道部',
      },
      {
        id: 'd1-north-gate',
        time: '16:30',
        name: '북문 (승은문)',
        local: '北門 承恩門',
        lng: 121.51122,
        lat: 25.04774,
        zoom: 18.4,
        radius: 250,
        kind: 'sight',
        desc: '청나라 때 세운 성문 가운데 원형에 가깝게 남은 문. 고가도로가 철거된 뒤 광장으로 정비되어 짧게 들르기 좋습니다.',
        hours: { text: '외관 상시 관람 (실내 개방 여부 확인 필요)', verified: false },
        booking: 'none',
        osmName: '北門|承恩門',
      },
      {
        id: 'd1-dadaocheng-wharf',
        time: '17:30',
        name: '다다오청 부두 강변',
        local: '大稻埕碼頭',
        lng: 121.50853,
        lat: 25.05637,
        zoom: 17,
        radius: 320,
        kind: 'rest',
        desc: '단수이강 제방 너머 강변 공원. 컨테이너 노점과 벤치에서 쉬며 해 지는 방향을 바라봅니다. 걷기 부담이 크면 택시로 이동하세요.',
        hours: { text: '강변 공원 상시 개방 · 노점 운영 시간 확인 필요', verified: false },
        booking: 'none',
        osmName: '大稻埕碼頭',
      },
      {
        id: 'd1-yansan',
        time: '19:00',
        name: '옌싼 야시장',
        local: '延三夜市',
        lng: 121.5122,
        lat: 25.0626,
        zoom: 17.2,
        radius: 320,
        kind: 'food',
        desc: '옌핑베이루 3단 길가에 늘어선 동네 야시장. 관광 야시장보다 짧고 조용하며, 주민들이 저녁을 사 가는 노포가 많습니다.',
        hours: { text: '점포별 영업 시간 상이 · 확인 필요', verified: false },
        booking: 'none',
        osmName: '延三',
      },
    ],
    move: 'MRT 베이먼역에서 철도부·북문은 도보 5분 안. 북문 → 다다오청 부두는 약 1.2km(도보 20분 안팎) 또는 택시. 부두 → 옌싼 야시장은 약 1km.',
    eat: '옌싼 야시장에서 소분 메뉴를 나눠 먹는 방식이 좋습니다. 점포 이름 대신 줄이 짧고 회전이 빠른 곳을 고르세요.',
    reserve: '예약한 항목 없음. 철도부 원구는 현장 매표입니다.',
    rain: '강변 대신 철도부 원구 관람 시간을 늘리거나, 실내 위주로 다다오청 디화제 골목의 아케이드 상점을 걸어 보세요.',
  },
  {
    id: 2,
    title: '다룽둥의 사당과 미술관',
    area: '다퉁구 · 중산구 북쪽',
    summary:
      '오래된 사당 두 곳으로 아침을 열고, 시장에서 점심을 먹은 뒤 미술관과 고택으로 이어지는 하루. 오후 중간에 카페 휴식을 넣었습니다.',
    places: [
      {
        id: 'd2-baoan',
        time: '09:30',
        name: '다룽둥 바오안궁',
        local: '大龍峒保安宮',
        lng: 121.51553,
        lat: 25.07309,
        zoom: 18.1,
        radius: 340,
        kind: 'sight',
        desc: '보생대제를 모시는 사당. 복원 과정이 잘 기록된 곳으로, 지붕 장식과 벽화를 아침 빛에 보기 좋습니다. 참배객을 방해하지 않도록 조용히.',
        hours: { text: '운영 시간 확인 필요', verified: false },
        booking: 'none',
        osmName: '保安宮',
      },
      {
        id: 'd2-confucius',
        time: '10:40',
        name: '타이베이 공자묘',
        local: '臺北市孔廟',
        lng: 121.51637,
        lat: 25.07264,
        zoom: 18,
        radius: 300,
        kind: 'sight',
        desc: '바오안궁 바로 옆. 화려한 장식 대신 절제된 배치를 보여 주는 공간이라 앞선 사당과 대비가 선명합니다.',
        hours: { text: '운영 시간·휴관일 확인 필요', verified: false },
        booking: 'none',
        osmName: '孔廟',
      },
      {
        id: 'd2-qingguang',
        time: '12:00',
        name: '칭광 시장',
        local: '晴光市場',
        lng: 121.5243,
        lat: 25.06624,
        zoom: 17.6,
        radius: 300,
        kind: 'food',
        desc: '중산구 주민들이 장을 보는 골목 시장. 간단한 국수와 간식으로 점심을 해결하고 근처 카페에서 쉬어 갑니다.',
        hours: { text: '점포별 상이 · 오전–이른 오후가 활발 (확인 필요)', verified: false },
        booking: 'none',
        osmName: '晴光市場',
      },
      {
        id: 'd2-tfam',
        time: '14:30',
        name: '타이베이 시립미술관',
        local: '臺北市立美術館',
        lng: 121.52485,
        lat: 25.0724,
        zoom: 17.3,
        radius: 360,
        kind: 'sight',
        desc: '격자형으로 겹쳐 쌓은 직육면체 볼륨이 특징인 미술관. 전시 교체 기간에는 일부 전시실이 닫힐 수 있습니다.',
        hours: { text: '월 휴관으로 알려져 있음 · 시간 확인 필요', verified: false },
        closedDays: [1],
        booking: 'none',
        osmName: '臺北市立美術館|美術館',
      },
      {
        id: 'd2-lin-antai',
        time: '16:30',
        name: '린안타이 고택',
        local: '林安泰古厝',
        lng: 121.529,
        lat: 25.0717,
        zoom: 18.2,
        radius: 300,
        kind: 'sight',
        desc: '원래 다른 곳에 있던 청대 민가를 옮겨 복원한 고택. 앞마당 연못과 낮은 지붕선이 공원 녹지와 이어집니다.',
        hours: { text: '운영 시간·휴관일 확인 필요', verified: false },
        booking: 'none',
        osmName: '林安泰',
      },
    ],
    move: 'MRT 위안산역에서 바오안궁·공자묘까지 도보 약 10분. 공자묘 → 칭광 시장은 버스 또는 택시(약 1.5km). 시장 → 미술관은 도보 20분 정도이므로 더운 날은 택시를 권합니다.',
    eat: '칭광 시장 주변은 점심 장사가 중심입니다. 오후 늦게는 문을 닫는 점포가 있어 12시 전후 방문이 좋습니다.',
    reserve: '예약한 항목 없음. 미술관은 특별전에 따라 유료 여부가 달라질 수 있습니다.',
    rain: '사당 두 곳은 처마 아래 동선이 많습니다. 비가 굵어지면 린안타이 고택을 빼고 미술관 관람 시간을 늘리세요.',
  },
  {
    id: 3,
    title: '스린의 새 극장, 베이터우의 온천 마을',
    area: '스린구 · 베이터우구',
    summary:
      '구조가 독특한 공연장을 밖에서 둘러본 뒤, 북쪽 온천 마을로 올라가 시장 점심과 목조 건축을 봅니다. 오후 늦게는 공중 목욕탕이나 공원에서 쉬는 시간입니다.',
    places: [
      {
        id: 'd3-tpac',
        time: '10:00',
        name: '타이베이 공연예술센터',
        local: '臺北表演藝術中心',
        lng: 121.52458,
        lat: 25.08488,
        zoom: 17.4,
        radius: 340,
        kind: 'sight',
        desc: '정육면체 몸체에 구형 극장이 끼워진 독특한 볼륨. 건물 사이를 관통하는 공공 동선 일부는 공연 표 없이도 걸을 수 있다고 안내됩니다.',
        hours: { text: '공공 구역 개방 시간·건축 투어 운영 여부 확인 필요', verified: false },
        booking: 'recommended',
        bookingNote: '건축 투어를 원하면 공식 사이트에서 일정 확인 후 예약.',
        osmName: '臺北表演藝術中心',
      },
      {
        id: 'd3-beitou-market',
        time: '12:00',
        name: '베이터우 시장',
        local: '北投市場',
        lng: 121.5014,
        lat: 25.1319,
        zoom: 17.8,
        radius: 300,
        kind: 'food',
        desc: 'MRT 베이터우역 앞 재래시장 건물. 2층 먹거리 구역은 주민 단골이 많은 곳으로, 점심 장사가 끝나면 빠르게 문을 닫습니다.',
        hours: { text: '점포별 상이 · 점심 이후 일찍 닫는 곳 많음 (확인 필요)', verified: false },
        booking: 'none',
        osmName: '北投市場',
      },
      {
        id: 'd3-hotspring-museum',
        time: '14:00',
        name: '베이터우 온천박물관',
        local: '北投溫泉博物館',
        lng: 121.50685,
        lat: 25.13667,
        zoom: 18.3,
        radius: 340,
        kind: 'sight',
        desc: '1913년 공중 목욕탕을 고친 박물관. 붉은 벽돌 아래층과 목조 위층이 만나는 구조, 아치 회랑으로 둘러싼 대욕장이 볼거리입니다. 실내에서는 신발을 벗습니다.',
        hours: {
          text: '화–일 09:00–17:00 · 월요일과 국경일 휴관 (국경일이 토·일이면 개관) · 무료',
          verified: true,
          source: HOTSPRING,
        },
        closedDays: [1],
        booking: 'none',
        osmName: '北投溫泉博物館',
      },
      {
        id: 'd3-beitou-library',
        time: '15:00',
        name: '베이터우 공공도서관',
        local: '臺北市立圖書館 北投分館',
        lng: 121.50599,
        lat: 25.13618,
        zoom: 18.4,
        radius: 260,
        kind: 'rest',
        desc: '공원 숲속의 목조 친환경 도서관. 열람 공간이므로 사진은 짧게, 발코니에서 잠시 쉬어 가는 정도가 좋습니다.',
        hours: { text: '운영 시간·휴관일 확인 필요', verified: false },
        booking: 'none',
        osmName: '北投分館',
      },
      {
        id: 'd3-takinoyu',
        time: '16:30',
        name: '다키노유 공중 목욕탕 (선택)',
        local: '瀧乃湯',
        lng: 121.5093,
        lat: 25.1375,
        zoom: 18.4,
        radius: 260,
        kind: 'rest',
        desc: '오래된 공중 목욕탕. 남녀 탕이 나뉜 대중탕 방식이라 체력이 남았을 때만 선택하세요. 원치 않으면 베이터우 공원 산책으로 대신합니다.',
        hours: { text: '운영 시간·요금·청소 휴무 확인 필요', verified: false },
        booking: 'none',
        osmName: '瀧乃湯',
      },
    ],
    move: 'MRT 젠탄역 또는 스린역에서 공연예술센터까지 도보 이동. 이후 MRT 단수이신이선으로 베이터우역, 신베이터우 지선으로 한 정거장. 박물관·도서관·목욕탕은 모두 공원 안에서 도보 10분 이내.',
    eat: '베이터우 시장 2층 먹거리 구역에서 점심. 오후 간식은 공원 주변 찻집에서.',
    reserve: '예약한 항목 없음. 공연예술센터 건축 투어를 원하면 사전 예약이 필요할 수 있습니다(확인 필요).',
    rain: '온천박물관과 도서관 모두 실내라 비 오는 날에도 동선이 유지됩니다. 공연예술센터는 외관 관람 시간을 줄이세요.',
  },
  {
    id: 4,
    title: '기차 공장과 민생 사구의 그늘',
    area: '신이구 북쪽 · 쑹산구',
    summary:
      '옛 철도 정비 공장을 박물관으로 바꾼 넓은 부지를 오전에 걷고, 가로수가 많은 주거 지역에서 점심과 휴식. 저녁은 퇴근길 주민이 많은 야시장으로.',
    places: [
      {
        id: 'd4-railway-museum',
        time: '10:00',
        name: '국가철도박물관 (옛 타이베이 기창)',
        local: '國家鐵道博物館 (舊臺北機廠)',
        lng: 121.5617,
        lat: 25.0446,
        zoom: 16.9,
        radius: 480,
        kind: 'sight',
        desc: '국정 고적으로 지정된 옛 철도 정비 공장. 대형 공장동과 직원 목욕탕, 총사무소 등 1930년대 건물이 넓게 흩어져 있어 지도로 배치를 먼저 보면 걷기 편합니다.',
        hours: {
          text: '화–일 09:30–17:00 · 월요일·태풍 등 공공기관 휴무일 휴관 · 대부분 무료(디젤·전기 공장동 유료)',
          verified: true,
          source: NRM,
        },
        closedDays: [1],
        booking: 'online-sales',
        bookingNote:
          '일반 관람은 예약 없이 입장(공식 FAQ). 주말·공휴일 열차 탑승 체험은 별도 판매로 알려져 있으나 운영 여부 확인 필요.',
        osmName: '國家鐵道博物館|臺北機廠',
      },
      {
        id: 'd4-fujin',
        time: '13:00',
        name: '푸진제 · 민생 사구',
        local: '富錦街 · 民生社區',
        lng: 121.5579,
        lat: 25.06045,
        zoom: 17.2,
        radius: 360,
        kind: 'food',
        desc: '1960–70년대 계획 주거 단지. 가로수 터널 아래 작은 식당과 카페가 흩어져 있어 점심 후 천천히 걷기 좋습니다.',
        hours: { text: '점포별 상이 · 확인 필요', verified: false },
        booking: 'none',
        osmName: '富錦街',
      },
      {
        id: 'd4-minsheng-park',
        time: '15:00',
        name: '민생 공원에서 쉬기',
        local: '民生公園',
        lng: 121.56205,
        lat: 25.0592,
        zoom: 17.2,
        radius: 300,
        kind: 'rest',
        desc: '동네 공원. 숙소로 돌아가기 전 그늘에서 쉬는 시간으로 비워 두었습니다.',
        hours: { text: '공원 상시 개방', verified: false },
        booking: 'none',
        osmName: '民生公園',
      },
      {
        id: 'd4-linjiang',
        time: '18:30',
        name: '린장제 야시장',
        local: '臨江街觀光夜市',
        lng: 121.5541,
        lat: 25.03,
        zoom: 17.4,
        radius: 340,
        kind: 'food',
        desc: '퉁화제 야시장으로도 불리는 동네형 야시장. 길이가 짧고 주거지 한가운데 있어 퇴근한 주민들로 붐빕니다.',
        hours: { text: '저녁 영업 · 점포별 상이 (확인 필요)', verified: false },
        booking: 'none',
        osmName: '臨江街|通化',
      },
    ],
    move: '철도박물관은 MRT 난징싼민역 또는 스정푸역에서 도보 10–15분. 박물관 → 민생 사구는 택시 약 10분. 저녁 야시장은 MRT 신이안허역에서 도보.',
    eat: '푸진제 주변은 브런치·카페 중심, 저녁은 린장제 야시장에서 가볍게 여러 가지를.',
    reserve:
      '예약한 항목 없음. 철도박물관 일반 관람은 예약 불필요(공식 FAQ). 열차 탑승 체험을 원하면 공식 사이트에서 판매 방식 확인.',
    rain: '철도박물관은 대형 공장동 안으로 동선을 바꾸고, 민생 공원 대신 푸진제 카페에서 쉬세요.',
  },
  {
    id: 5,
    title: '식물원 아침, 강가 마을에서 마무리',
    area: '중정구 남쪽 · 공관',
    summary:
      '출국일이라 오전과 점심까지만 채웠습니다. 아침 식물원에서 시작해 문학 기념 공간과 강가 언덕 마을을 걷고, 오후에는 공항으로.',
    places: [
      {
        id: 'd5-botanical',
        time: '09:00',
        name: '타이베이 식물원',
        local: '臺北植物園',
        lng: 121.5097,
        lat: 25.03222,
        zoom: 16.9,
        radius: 380,
        kind: 'rest',
        desc: '연못과 열대 식물 구역이 있는 도심 식물원. 오전에는 산책하는 주민이 많고, 공원 안 오래된 목조 건물도 함께 볼 수 있습니다.',
        hours: { text: '개방 시간 확인 필요', verified: false },
        booking: 'none',
        osmName: '植物園',
      },
      {
        id: 'd5-kishu-an',
        time: '10:30',
        name: '지슈안 문학의 숲',
        local: '紀州庵文學森林',
        lng: 121.52235,
        lat: 25.01853,
        zoom: 18.3,
        radius: 300,
        kind: 'sight',
        desc: '일본 통치기 요정 건물의 남은 부분을 복원한 목조 건물과 문학관. 큰 나무가 있는 마당에서 잠깐 쉬어 가기 좋습니다.',
        hours: { text: '운영 시간·휴관일 확인 필요', verified: false },
        booking: 'none',
        osmName: '紀州庵',
      },
      {
        id: 'd5-shuiyuan',
        time: '12:00',
        name: '공관 수이위안 시장 주변 점심',
        local: '水源市場',
        lng: 121.5319,
        lat: 25.0146,
        zoom: 17.6,
        radius: 300,
        kind: 'food',
        desc: '대학가 공관의 시장 건물과 주변 골목. 학생과 주민이 찾는 저렴한 식당이 많습니다.',
        hours: { text: '점포별 상이 · 확인 필요', verified: false },
        booking: 'none',
        osmName: '水源市場',
      },
      {
        id: 'd5-treasure-hill',
        time: '13:30',
        name: '바오창옌 국제예술촌',
        local: '寶藏巖國際藝術村',
        lng: 121.53194,
        lat: 25.01067,
        zoom: 17.9,
        radius: 340,
        kind: 'sight',
        desc: '강가 언덕에 자연 발생적으로 들어선 주거지를 보존한 마을. 지금도 주민이 살고 있으니 조용히 걷고 사적인 공간은 들어가지 않습니다.',
        hours: {
          text: '11:00 개방 · 월요일 휴무로 안내됨 · 폐장 시각은 시즌별로 달라 확인 필요',
          verified: false,
        },
        closedDays: [1],
        booking: 'none',
        osmName: '寶藏巖',
      },
    ],
    move: '식물원은 MRT 샤오난먼역에서 도보. 식물원 → 지슈안은 택시 약 10분. 지슈안 → 공관은 MRT 구팅역에서 공관역까지. 바오창옌은 공관역에서 도보 10–15분, 언덕 계단이 많습니다.',
    eat: '점심은 수이위안 시장 주변. 바오창옌 안 카페는 휴식용으로만 생각하세요.',
    reserve: '예약한 항목 없음. 출국 항공편 시간에 맞춰 바오창옌 체류 시간을 줄이세요.',
    rain: '바오창옌의 언덕 계단은 젖으면 미끄럽습니다. 비가 오면 지슈안에서 시간을 보내고 바오창옌은 생략하세요.',
  },
];

export const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'];

export const HOLIDAY_SOURCE: Source = {
  label: '행정원 인사행정총처 「정부 행정기관 업무 달력」 (2027년분 2026-05-21 발표 보도)',
  url: 'https://news.ltn.com.tw/news/Taipei/breakingnews/5444819',
};

/** 공식 발표 보도에서 확인한 2027년 연휴 일부 (전체 목록이 아닙니다) */
export const HOLIDAYS_2027: { from: string; to: string; name: string }[] = [
  { from: '2027-01-01', to: '2027-01-03', name: '개국기념일 연휴' },
  { from: '2027-02-04', to: '2027-02-10', name: '음력 설 연휴' },
  { from: '2027-02-27', to: '2027-03-01', name: '화평기념일 연휴' },
  { from: '2027-12-31', to: '2027-12-31', name: '2028 개국기념일 대체휴일' },
];
