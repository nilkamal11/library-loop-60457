import type { SourceKind } from './live-event';

export type FeedType = 'librarycalendar' | 'tribe' | 'civicplus' | 'squarespace' | 'communico' | 'rss' | 'bibliocommons' | 'mycalendar';

export type BranchRule = {
  match: string;
  distance: number;
  address: string;
};

export type FeedConfig = {
  id: string;
  name: string;
  endpoint: string;
  type: FeedType;
  sourceKind: SourceKind;
  distance: number;
  address: string;
  detailBase?: string;
  venueDistance?: boolean;
  icsUtc?: boolean;
  maxPages?: number;
  branchRules?: BranchRule[];
  strictBranchDistance?: boolean;
  multiBranchAddress?: string;
};

export const ZIP_CENTER = { lat: 41.7244, lng: -87.8273 };

const CHICAGO_BIBLIO_AUDIENCES = '53f250153860d10000000010,5bc796d5c0db9c5c64d684c9,53f250153860d10000000011';
const CHICAGO_BIBLIO_LOCATIONS = '21,31,63,82,77,52,5,19,10,72,29,13,14,76,68,81,69,9,78,64,40,45,50,59,80,25,17,6,42,23,32,22,33,75,8,47,18,4,41,90,54,62,48,24,12,20,39,30,55,66,88,36,65,79,34,74';
const CHICAGO_BIBLIO_ENDPOINT = `https://gateway.bibliocommons.com/v2/libraries/chipublib/rss/events?audiences=${CHICAGO_BIBLIO_AUDIENCES}&locations=${CHICAGO_BIBLIO_LOCATIONS}`;

export const structuredSources: FeedConfig[] = [
  { id: 'green-hills', name: 'Green Hills Public Library District', endpoint: 'https://greenhillspld.librarycalendar.com/events/feed/json', type: 'librarycalendar', sourceKind: 'Library', distance: 1.4, address: '8611 W 103rd St, Palos Hills, IL 60465' },
  { id: 'prairie-trails', name: 'Prairie Trails Public Library District', endpoint: 'https://prairietrails.librarycalendar.com/events/feed/json', type: 'librarycalendar', sourceKind: 'Library', distance: 3.06, address: '8449 S Moody Ave, Burbank, IL 60459' },
  { id: 'oak-lawn-library', name: 'Oak Lawn Public Library', endpoint: 'https://oaklawnpl.librarycalendar.com/events/feed/json', type: 'librarycalendar', sourceKind: 'Library', distance: 3.97, address: '9427 S Raymond Ave, Oak Lawn, IL 60453' },
  { id: 'palos-heights-library', name: 'Palos Heights Public Library', endpoint: 'https://palosheights.librarycalendar.com/events/feed/json', type: 'librarycalendar', sourceKind: 'Library', distance: 4.51, address: '12501 S 71st Ave, Palos Heights, IL 60463' },
  { id: 'la-grange', name: 'La Grange Public Library', endpoint: 'https://lagrange.librarycalendar.com/events/feed/json', type: 'librarycalendar', sourceKind: 'Library', distance: 6.46, address: '10 W Cossitt Ave, La Grange, IL 60525' },
  { id: 'alsip-merrionette', name: 'Alsip-Merrionette Park Public Library District', endpoint: 'https://alsipmerrionette.librarycalendar.com/events/feed/json', type: 'librarycalendar', sourceKind: 'Library', distance: 6.59, address: '11960 S Pulaski Rd, Alsip, IL 60803' },
  { id: 'evergreen-park-library', name: 'Evergreen Park Public Library', endpoint: 'https://evergreenparklibrary.librarymarket.com/events/feed/json', type: 'librarycalendar', sourceKind: 'Library', distance: 6.65, address: '9400 S Troy Ave, Evergreen Park, IL 60805' },
  { id: 'thomas-ford', name: 'Thomas Ford Memorial Library', endpoint: 'https://www.fordlibrary.org/events/feed/json', type: 'librarycalendar', sourceKind: 'Library', distance: 7.1, address: '800 Chestnut St, Western Springs, IL 60558' },
  { id: 'orland-park-library', name: 'Orland Park Public Library', endpoint: 'https://orlandpark.librarycalendar.com/events/feed/json', type: 'librarycalendar', sourceKind: 'Library', distance: 7.39, address: '14921 S Ravinia Ave, Orland Park, IL 60462' },
  { id: 'bridgeview', name: 'Bridgeview Public Library', endpoint: 'https://bridgeviewlibrary.org/wp-json/tribe/events/v1/events', type: 'tribe', sourceKind: 'Library', distance: 1.81, address: '7840 W 79th St, Bridgeview, IL 60455' },
  { id: 'mccook', name: 'McCook Public Library District', endpoint: 'https://mccook.lib.il.us/wp-json/tribe/events/v1/events', type: 'tribe', sourceKind: 'Library', distance: 5.29, address: '8419 W 50th St, McCook, IL 60525' },
  { id: 'indian-prairie-library', name: 'Indian Prairie Public Library District', endpoint: 'https://ippl.libcal.com/ical_subscribe.php?src=p&cid=9323', type: 'civicplus', sourceKind: 'Library', distance: 6.88, address: '401 Plainfield Rd, Darien, IL 60561', icsUtc: true },
  { id: 'north-riverside-library', name: 'North Riverside Public Library District', endpoint: 'https://www.nrpl.info/wp-json/tribe/events/v1/events', type: 'tribe', sourceKind: 'Library', distance: 8.47, address: '2400 S Des Plaines Ave, North Riverside, IL 60546' },
  { id: 'acorn-library', name: 'Acorn Public Library District', endpoint: 'https://acornlibrary.org/wp-json/tribe/events/v1/events', type: 'tribe', sourceKind: 'Library', distance: 8.89, address: '15624 Central Ave, Oak Forest, IL 60452' },
  { id: 'westmont-library', name: 'Westmont Public Library', endpoint: 'https://westmontlibrary.libcal.com/ical_subscribe.php?src=p&cid=21445', type: 'civicplus', sourceKind: 'Library', distance: 9.44, address: '428 N Cass Ave, Westmont, IL 60559', icsUtc: true },
  { id: 'chicago-ridge-library', name: 'Chicago Ridge Public Library', endpoint: 'https://chicagoridgepubliclibrary.libnet.info/eeventcaldata', type: 'communico', sourceKind: 'Library', distance: 3.04, address: '10400 Oxford Ave, Chicago Ridge, IL 60415' },
  { id: 'chicago-public-library', name: 'Chicago Public Library', endpoint: CHICAGO_BIBLIO_ENDPOINT, type: 'bibliocommons', sourceKind: 'Library', distance: 4.4, address: '6423 W 63rd Pl, Chicago, IL 60638', maxPages: 8 },
  { id: 'stickney-forest-view-library', name: 'Stickney-Forest View Public Library District', endpoint: 'https://sfvpld.libcal.com/ical_subscribe.php?src=p&cid=19438', type: 'civicplus', sourceKind: 'Library', distance: 6.53, address: '6800 W 43rd St, Stickney, IL 60402', icsUtc: true },
  { id: 'riverside-library', name: 'Riverside Public Library', endpoint: 'https://riversidelibrary.libcal.com/ical_subscribe.php?src=p&cid=14332', type: 'civicplus', sourceKind: 'Library', distance: 7.12, address: '1 Burling Rd, Riverside, IL 60546', icsUtc: true },
  { id: 'brookfield-library', name: 'Linda Sokol Francis Brookfield Library', endpoint: 'https://lsfbrookfieldlibrary.libnet.info/eeventcaldata', type: 'communico', sourceKind: 'Library', distance: 7.13, address: '3541 Park Ave, Brookfield, IL 60513' },
  { id: 'hinsdale-library', name: 'Hinsdale Public Library', endpoint: 'https://hinsdale.libnet.info/eeventcaldata', type: 'communico', sourceKind: 'Library', distance: 7.58, address: '20 E Maple St, Hinsdale, IL 60521' },
  { id: 'clarendon-hills-library', name: 'Clarendon Hills Public Library', endpoint: 'https://clarendonhillslibrary.libcal.com/ical_subscribe.php?src=p&cid=19818', type: 'civicplus', sourceKind: 'Library', distance: 8.25, address: '7 N Prospect Ave, Clarendon Hills, IL 60514', icsUtc: true },
  { id: 'berwyn-library', name: 'Berwyn Public Library', endpoint: 'https://berwynlibrary.libcal.com/ical_subscribe.php?src=p&cid=11242', type: 'civicplus', sourceKind: 'Library', distance: 8.25, address: '2701 S Harlem Ave, Berwyn, IL 60402', icsUtc: true },
  { id: 'midlothian-library', name: 'Midlothian Public Library', endpoint: 'https://midlothian.librarycalendar.com/events/feed/json', type: 'librarycalendar', sourceKind: 'Library', distance: 8.47, address: '14701 S Kenton Ave, Midlothian, IL 60445' },
  { id: 'blue-island-library', name: 'Blue Island Public Library', endpoint: 'https://blueislandpl.librarycalendar.com/events/feed/json', type: 'librarycalendar', sourceKind: 'Library', distance: 8.93, address: '2433 York St, Blue Island, IL 60406' },
  { id: 'cicero-library', name: 'Cicero Public Library', endpoint: 'https://ciceropl.librarycalendar.com/events/feed/json', type: 'librarycalendar', sourceKind: 'Library', distance: 9.59, address: '5225 W Cermak Rd, Cicero, IL 60804' },
  { id: 'westchester-library', name: 'Westchester Public Library', endpoint: 'https://westchesterpl.libcal.com/ical_subscribe.php?src=p&cid=18760', type: 'civicplus', sourceKind: 'Library', distance: 9.6, address: '10700 Canterbury St, Westchester, IL 60154', icsUtc: true },
  { id: 'broadview-library', name: 'Broadview Public Library District', endpoint: 'https://broadviewlibrary.libcal.com/ical_subscribe.php?src=p&cid=7531', type: 'civicplus', sourceKind: 'Library', distance: 9.71, address: '2226 S 16th Ave, Broadview, IL 60155', icsUtc: true },
  { id: 'calumet-park-library', name: 'Calumet Park Public Library', endpoint: 'https://cpplibrary.org/wp-json/my-calendar/v1/events', type: 'mycalendar', sourceKind: 'Library', distance: 9.77, address: '1500 W 127th St, Calumet Park, IL 60827' },
  { id: 'lemont-library', name: 'Lemont Public Library District', endpoint: 'https://lemontlibrary.libnet.info/eeventcaldata', type: 'communico', sourceKind: 'Library', distance: 10.04, address: '50 E Wend St, Lemont, IL 60439' },
  { id: 'homer-township-library', name: 'Homer Township Public Library District', endpoint: 'https://www.homerlibrary.org/events/feed/json', type: 'librarycalendar', sourceKind: 'Library', distance: 10.42, address: '14320 W 151st St, Homer Glen, IL 60491' },
  { id: 'oak-park-library', name: 'Oak Park Public Library', endpoint: 'https://oakpark.librarycalendar.com/events/feed/json', type: 'librarycalendar', sourceKind: 'Library', distance: 10.54, address: '845 S Gunderson Ave, Oak Park, IL 60304', multiBranchAddress: 'Multiple Oak Park Public Library locations; see official listing', branchRules: [
    { match: 'Maze Branch Library', distance: 10.54, address: '845 S Gunderson Ave, Oak Park, IL 60304' },
    { match: 'Main Library', distance: 11.52, address: '834 Lake St, Oak Park, IL 60301' },
    { match: 'Dole Branch Library', distance: 12.29, address: '255 Augusta St, Oak Park, IL 60302' },
    { match: 'Virtual', distance: 10.54, address: 'Online event' },
  ] },
  { id: 'downers-grove-library', name: 'Downers Grove Public Library', endpoint: 'https://downersgrove.libnet.info/eeventcaldata', type: 'communico', sourceKind: 'Library', distance: 10.55, address: '1050 Curtiss St, Downers Grove, IL 60515' },
  { id: 'tinley-park-library', name: 'Tinley Park Public Library', endpoint: 'https://tinley.libnet.info/eeventcaldata', type: 'communico', sourceKind: 'Library', distance: 11.18, address: '7851 Timber Dr, Tinley Park, IL 60477' },
  { id: 'hillside-library', name: 'Hillside Public Library', endpoint: 'https://hillsidepl.librarycalendar.com/events/feed/json', type: 'librarycalendar', sourceKind: 'Library', distance: 11.35, address: '405 N Hillside Ave, Hillside, IL 60162' },
  { id: 'woodridge-library', name: 'Woodridge Public Library', endpoint: 'https://www.woodridgelibrary.org/events/feed/json', type: 'librarycalendar', sourceKind: 'Library', distance: 11.35, address: '3 Plaza Dr, Woodridge, IL 60517' },
  { id: 'river-forest-library', name: 'River Forest Public Library', endpoint: 'https://www.riverforestlibrary.org/events/feed/json', type: 'librarycalendar', sourceKind: 'Library', distance: 11.7, address: '735 Lathrop Ave, River Forest, IL 60305' },
  { id: 'riverdale-library', name: 'Riverdale Public Library District', endpoint: 'https://rpld.org/wp-json/tribe/events/v1/events', type: 'tribe', sourceKind: 'Library', distance: 12.16, address: '208 W 144th St, Riverdale, IL 60827' },
  { id: 'fountaindale-library', name: 'Fountaindale Public Library District', endpoint: 'https://fountaindale.libnet.info/eeventcaldata', type: 'communico', sourceKind: 'Library', distance: 13, address: '300 W Briarcliff Rd, Bolingbrook, IL 60440' },
  { id: 'lisle-library', name: 'Lisle Library District', endpoint: 'https://lisle.librarycalendar.com/events/feed/json', type: 'librarycalendar', sourceKind: 'Library', distance: 13.23, address: '777 Front St, Lisle, IL 60532' },
  { id: 'mokena-library', name: 'Mokena Community Public Library District', endpoint: 'https://mokena.librarycalendar.com/events/feed/json', type: 'librarycalendar', sourceKind: 'Library', distance: 13.43, address: '11327 W 195th St, Mokena, IL 60448' },
  { id: 'elmhurst-library', name: 'Elmhurst Public Library', endpoint: 'https://elmhurstpubliclibrary.libcal.com/ical_subscribe.php?src=p&cid=19398', type: 'civicplus', sourceKind: 'Library', distance: 13.46, address: '125 S Prospect Ave, Elmhurst, IL 60126', icsUtc: true },
  { id: 'villa-park-library', name: 'Villa Park Public Library', endpoint: 'https://villapark.librarycalendar.com/events/feed/json', type: 'librarycalendar', sourceKind: 'Library', distance: 13.52, address: '305 S Ardmore Ave, Villa Park, IL 60181' },
  { id: 'northlake-library', name: 'Northlake Public Library District', endpoint: 'https://www.northlakelibrary.org/wp-json/tribe/events/v1/events', type: 'tribe', sourceKind: 'Library', distance: 13.52, address: '231 N Wolf Rd, Northlake, IL 60164' },
  { id: 'homewood-library', name: 'Homewood Public Library District', endpoint: 'https://homewood.librarycalendar.com/events/feed/json', type: 'librarycalendar', sourceKind: 'Library', distance: 13.92, address: '17917 Dixie Hwy, Homewood, IL 60430' },
  { id: 'white-oak-library', name: 'White Oak Library District', endpoint: 'https://whiteoak.librarycalendar.com/events/feed/json', type: 'librarycalendar', sourceKind: 'Library', distance: 14.05, address: '201 W Normantown Rd, Romeoville, IL 60446', strictBranchDistance: true, multiBranchAddress: 'Multiple White Oak Library District locations; see official listing', branchRules: [
    { match: 'Romeoville', distance: 14.05, address: '201 W Normantown Rd, Romeoville, IL 60446' },
    { match: 'Lockport', distance: 14.9, address: '121 E 8th St, Lockport, IL 60441' },
    { match: 'Crest Hill', distance: 18.32, address: '20670 City Center Blvd, Crest Hill, IL 60403' },
  ] },
  { id: 'elmwood-park-library', name: 'Elmwood Park Public Library', endpoint: 'https://elmwoodpark.librarycalendar.com/events/feed/json', type: 'librarycalendar', sourceKind: 'Library', distance: 14.06, address: '1 Conti Pkwy, Elmwood Park, IL 60707' },
  { id: 'south-holland-library', name: 'South Holland Public Library', endpoint: 'https://www.shlibrary.org/events/feed/json', type: 'librarycalendar', sourceKind: 'Library', distance: 14.22, address: '16250 Wausau Ave, South Holland, IL 60473' },
  { id: 'river-grove-library', name: 'River Grove Public Library District', endpoint: 'https://rivergrovelibrary.libcal.com/ical_subscribe.php?src=p&cid=5557', type: 'civicplus', sourceKind: 'Library', distance: 14.24, address: '8638 W Grand Ave, River Grove, IL 60171', icsUtc: true },
  { id: 'helen-plum-library', name: 'Helen Plum Library', endpoint: 'https://www.helenplum.org/events/feed/json', type: 'librarycalendar', sourceKind: 'Library', distance: 14.52, address: '411 S Main St, Lombard, IL 60148' },
  { id: 'franklin-park-library', name: 'Franklin Park Public Library District', endpoint: 'https://www.fppld.org/wp-json/tribe/events/v1/events', type: 'tribe', sourceKind: 'Library', distance: 14.52, address: '10311 Grand Ave, Franklin Park, IL 60131' },
  { id: 'flossmoor-library', name: 'Flossmoor Public Library', endpoint: 'https://flossmoor.librarycalendar.com/events/feed/json', type: 'librarycalendar', sourceKind: 'Library', distance: 14.67, address: '1000 Sterling Ave, Flossmoor, IL 60422' },
  { id: 'naperville-library', name: 'Naperville Public Library', endpoint: 'https://napervillepl.librarycalendar.com/events/feed/json', type: 'librarycalendar', sourceKind: 'Library', distance: 14.88, address: '2035 S Naper Blvd, Naperville, IL 60565', strictBranchDistance: true, multiBranchAddress: 'Multiple Naperville Public Library locations; see official listing', branchRules: [
    { match: 'Naper Blvd. Library', distance: 14.88, address: '2035 S Naper Blvd, Naperville, IL 60565' },
    { match: 'Nichols Library', distance: 16.96, address: '200 W Jefferson Ave, Naperville, IL 60540' },
    { match: '95th Street Library', distance: 19.18, address: '3015 Cedar Glade Dr, Naperville, IL 60564' },
    { match: 'Online', distance: 14.88, address: 'Online event' },
  ] },
  { id: 'fpdcc', name: 'Forest Preserves of Cook County', endpoint: 'https://fpdcc.com/wp-json/tribe/events/v1/events', type: 'tribe', sourceKind: 'Forest preserve', distance: 15, address: 'Venue varies', venueDistance: true, maxPages: 3 },
  { id: 'lake-katherine', name: 'Lake Katherine Nature Center', endpoint: 'https://www.lakekatherine.org/common/modules/iCalendar/iCalendar.aspx?catID=14&feed=calendar', type: 'civicplus', sourceKind: 'Forest preserve', distance: 3.6, address: '7402 Lake Katherine Dr, Palos Heights, IL 60463', detailBase: 'https://www.lakekatherine.org/calendar.aspx?EID=' },
  { id: 'western-springs-community', name: 'Western Springs Community Events', endpoint: 'https://www.wsprings.com/common/modules/iCalendar/iCalendar.aspx?catID=14&feed=calendar', type: 'civicplus', sourceKind: 'Recreation', distance: 7.8, address: 'Western Springs, IL 60558', detailBase: 'https://www.wsprings.com/calendar.aspx?EID=' },
  { id: 'chicago-ridge-parks', name: 'Chicago Ridge Park District', endpoint: 'https://chicagoridgeparks.com/wp-json/tribe/events/v1/events', type: 'tribe', sourceKind: 'Park district', distance: 3, address: '10736 Lombard Ave, Chicago Ridge, IL 60415' },
  { id: 'summit-parks', name: 'Summit Park District', endpoint: 'https://summitparks.org/wp-json/tribe/events/v1/events', type: 'tribe', sourceKind: 'Park district', distance: 4, address: '5700 S Archer Rd, Summit, IL 60501' },
  { id: 'oak-lawn-parks', name: 'Oak Lawn Park District', endpoint: 'https://www.olparks.com/wp-json/tribe/events/v1/events', type: 'tribe', sourceKind: 'Park district', distance: 4, address: '9401 S Oak Park Ave, Oak Lawn, IL 60453' },
  { id: 'lyons-parks', name: 'Village of Lyons Parks & Recreation', endpoint: 'https://www.villageoflyons-il.net/wp-json/tribe/events/v1/events', type: 'tribe', sourceKind: 'Recreation', distance: 6.3, address: '4200 Lawndale Ave, Lyons, IL 60534' },
  { id: 'westmont-parks', name: 'Westmont Park District', endpoint: 'https://www.westmontparks.org/wp-json/tribe/events/v1/events', type: 'tribe', sourceKind: 'Park district', distance: 9.4, address: '55 E Richmond St, Westmont, IL 60559' },
  { id: 'lemont-parks', name: 'Lemont Park District', endpoint: 'https://www.lemontparkdistrict.org/wp-json/tribe/events/v1/events', type: 'tribe', sourceKind: 'Park district', distance: 10, address: '16028 127th St, Lemont, IL 60439' },
  { id: 'oak-park-parks', name: 'Park District of Oak Park', endpoint: 'https://pdop.org/wp-json/tribe/events/v1/events', type: 'tribe', sourceKind: 'Park district', distance: 10.5, address: '218 Madison St, Oak Park, IL 60302', maxPages: 3 },
  { id: 'tinley-parks', name: 'Tinley Park-Park District', endpoint: 'https://tinleyparkdistrict.org/wp-json/tribe/events/v1/events', type: 'tribe', sourceKind: 'Park district', distance: 11.2, address: '8125 W 171st St, Tinley Park, IL 60477' },
  { id: 'woodridge-parks', name: 'Woodridge Park District', endpoint: 'https://www.woodridgeparks.org/wp-json/tribe/events/v1/events', type: 'tribe', sourceKind: 'Park district', distance: 11.4, address: '2600 Center Dr, Woodridge, IL 60517' },
  { id: 'dolton-parks', name: 'Dolton Park District', endpoint: 'https://doltonparkdistrict.org/wp-json/tribe/events/v1/events', type: 'tribe', sourceKind: 'Park district', distance: 12.8, address: '721 Engle St, Dolton, IL 60419', maxPages: 3 },
  { id: 'hf-parks', name: 'Homewood-Flossmoor Park District', endpoint: 'https://hfparks.com/wp-json/tribe/events/v1/events', type: 'tribe', sourceKind: 'Park district', distance: 14.3, address: '1824 Ridge Rd, Homewood, IL 60430' },
  { id: 'evergreen-rec', name: 'Evergreen Park Recreation', endpoint: 'https://www.evergreenpark-ill.com/common/modules/iCalendar/iCalendar.aspx?catID=22&feed=calendar', type: 'civicplus', sourceKind: 'Recreation', distance: 6.6, address: '3450 W 97th St, Evergreen Park, IL 60805', detailBase: 'https://www.evergreenpark-ill.com/calendar.aspx?EID=' },
  { id: 'evergreen-youth', name: 'Evergreen Park Youth Programs', endpoint: 'https://www.evergreenpark-ill.com/common/modules/iCalendar/iCalendar.aspx?catID=26&feed=calendar', type: 'civicplus', sourceKind: 'Recreation', distance: 6.6, address: '3450 W 97th St, Evergreen Park, IL 60805', detailBase: 'https://www.evergreenpark-ill.com/calendar.aspx?EID=' },
  { id: 'palos-heights-rec', name: 'Palos Heights Parks & Recreation', endpoint: 'https://www.palosheightsrec.org/common/modules/iCalendar/iCalendar.aspx?catID=25&feed=calendar', type: 'civicplus', sourceKind: 'Recreation', distance: 4.7, address: '6601 W 127th St, Palos Heights, IL 60463', detailBase: 'https://www.palosheightsrec.org/calendar.aspx?EID=' },
  { id: 'indian-head-rec', name: 'Indian Head Park Recreation', endpoint: 'https://indianheadpark-il.gov/common/modules/iCalendar/iCalendar.aspx?catID=22&feed=calendar', type: 'civicplus', sourceKind: 'Recreation', distance: 6.2, address: '201 Acacia Dr, Indian Head Park, IL 60525', detailBase: 'https://www.indianheadpark-il.gov/calendar.aspx?EID=' },
  { id: 'bedford-parks', name: 'Bedford Park District', endpoint: 'https://www.bedfordparkdistrict.org/common/modules/iCalendar/iCalendar.aspx?catID=14&feed=calendar', type: 'civicplus', sourceKind: 'Park district', distance: 3.5, address: '6652 S 78th Ave, Bedford Park, IL 60638', detailBase: 'https://www.bedfordparkdistrict.org/calendar.aspx?EID=' },
  { id: 'burbank-parks', name: 'Burbank Park District', endpoint: 'https://www.burbankil.gov/common/modules/iCalendar/iCalendar.aspx?catID=29&feed=calendar', type: 'civicplus', sourceKind: 'Park district', distance: 4.7, address: '6100 W 85th St, Burbank, IL 60459', detailBase: 'https://www.burbankil.gov/calendar.aspx?EID=' },
  { id: 'palos-park-rec', name: 'Palos Park Recreation & Parks', endpoint: 'https://www.palospark.org/common/modules/iCalendar/iCalendar.aspx?catID=30&feed=calendar', type: 'civicplus', sourceKind: 'Recreation', distance: 7.5, address: '8901 W 123rd St, Palos Park, IL 60464', detailBase: 'https://www.palospark.org/calendar.aspx?EID=' },
  { id: 'north-riverside-rec', name: 'North Riverside Parks & Recreation', endpoint: 'https://www.northriverside-il.org/common/modules/iCalendar/iCalendar.aspx?catID=24&feed=calendar', type: 'civicplus', sourceKind: 'Recreation', distance: 8.5, address: '2401 S Des Plaines Ave, North Riverside, IL 60546', detailBase: 'https://www.northriverside-il.org/calendar.aspx?EID=' },
  { id: 'forest-park-parks', name: 'Forest Park Park District', endpoint: 'https://www.pdofp.org/events?format=json', type: 'squarespace', sourceKind: 'Park district', distance: 10.5, address: '7501 Harrison St, Forest Park, IL 60130' },
  { id: 'maywood-parks', name: 'Maywood Park District', endpoint: 'https://www.maywoodparkdistrict.org/2026-calendar?format=json', type: 'squarespace', sourceKind: 'Park district', distance: 11.3, address: '921 S 9th Ave, Maywood, IL 60153' },
  { id: 'lisle-parks', name: 'Lisle Park District', endpoint: 'https://www.calendarwiz.com/CalendarWiz_iCal.php?crd=lisleparkdistrict', type: 'civicplus', sourceKind: 'Park district', distance: 13.2, address: '1925 Ohio St, Lisle, IL 60532', icsUtc: true },
  { id: 'villa-park-events', name: 'Villa Park Parks & Recreation', endpoint: 'https://villaparkil.gov/common/modules/iCalendar/iCalendar.aspx?catID=35&feed=calendar', type: 'civicplus', sourceKind: 'Recreation', distance: 13.5, address: '320 E Wildwood Ave, Villa Park, IL 60181', detailBase: 'https://villaparkil.gov/calendar.aspx?EID=' },
  { id: 'elmwood-park-rec', name: 'Elmwood Park Parks & Recreation', endpoint: 'https://www.elmwoodpark.org/common/modules/iCalendar/iCalendar.aspx?catID=25&feed=calendar', type: 'civicplus', sourceKind: 'Recreation', distance: 14.1, address: '2 Conti Pkwy, Elmwood Park, IL 60707', detailBase: 'https://www.elmwoodpark.org/calendar.aspx?EID=' },
];
