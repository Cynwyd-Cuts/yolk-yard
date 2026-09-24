import {sqliteTable,text,integer,index} from 'drizzle-orm/sqlite-core';
export const rooms=sqliteTable('rooms',{
 code:text('code').primaryKey(), public:integer('public').notNull(),
 host:text('host').notNull(), guest:text('guest'),
 hostSeen:integer('host_seen').notNull(), guestSeen:integer('guest_seen').notNull().default(0),
 hostMessages:integer('host_messages').notNull().default(0), guestMessages:integer('guest_messages').notNull().default(0),
 expires:integer('expires').notNull()
},t=>[index('rooms_public_seen').on(t.public,t.hostSeen)]);
export const relayPeers=sqliteTable('relay_peers',{
 id:text('id').primaryKey(), token:text('token').notNull(), seen:integer('seen').notNull(),
 listing:text('listing'), listedAt:integer('listed_at').notNull().default(0)
},t=>[index('relay_peers_seen').on(t.seen)]);
export const relayLinks=sqliteTable('relay_links',{
 id:text('id').primaryKey(), a:text('a').notNull(), b:text('b').notNull(),
 aId:text('a_id').notNull(), bId:text('b_id').notNull()
},t=>[index('relay_links_a').on(t.a),index('relay_links_b').on(t.b)]);
export const relayPackets=sqliteTable('relay_packets',{
 seq:integer('seq').primaryKey({autoIncrement:true}), recipient:text('recipient').notNull(),
 data:text('data').notNull(), final:integer('final').notNull(), expires:integer('expires').notNull()
},t=>[index('relay_packets_recipient_seq').on(t.recipient,t.seq),index('relay_packets_expires').on(t.expires)]);
