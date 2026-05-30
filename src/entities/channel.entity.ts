import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export enum ChannelType {
  PUBLIC = 'public',
  PRIVATE = 'private',
  REQUEST = 'request',
  BOT = 'bot',
}

@Entity('channels')
export class ChannelEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  channel_id: string;

  @Column()
  title: string;

  @Column({ nullable: true })
  username: string;

  @Column({
    type: 'enum',
    enum: ChannelType,
    default: ChannelType.PUBLIC,
  })
  type: ChannelType;

  @Column({ nullable: true })
  invite_link: string;

  @CreateDateColumn()
  created_at: Date;
}
