import { MediaRequestStatus, MediaStatus } from '@server/constants/media';
import { getRepository } from '@server/datasource';
import MediaRequest from '@server/entity/MediaRequest';
import SeasonRequest from '@server/entity/SeasonRequest';
import {
  AfterUpdate,
  Column,
  CreateDateColumn,
  Entity,
  In,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import Media from './Media';

@Entity()
class Season {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column()
  public seasonNumber: number;

  @Column({ type: 'int', default: MediaStatus.UNKNOWN })
  public status: MediaStatus;

  @Column({ type: 'int', default: MediaStatus.UNKNOWN })
  public status4k: MediaStatus;

  @ManyToOne(() => Media, (media) => media.seasons, { onDelete: 'CASCADE' })
  public media: Promise<Media>;

  @CreateDateColumn()
  public createdAt: Date;

  @UpdateDateColumn()
  public updatedAt: Date;

  constructor(init?: Partial<Season>) {
    Object.assign(this, init);
  }

  @AfterUpdate()
  public async isThisWorking(): Promise<void> {
    const requestRepository = getRepository(MediaRequest);
    const seasonRequestRepository = getRepository(SeasonRequest);

    const relatedRequests = await requestRepository.find({
      relations: {
        media: true,
      },
      where: {
        media: { id: (await this.media).id },
        status: In([MediaRequestStatus.APPROVED, MediaRequestStatus.COMPLETED]),
      },
    });

    if (relatedRequests.length > 0) {
      relatedRequests.forEach(async (request) => {
        const relatedSeasonRequest = await seasonRequestRepository.findOne({
          relations: {
            request: true,
          },
          where: {
            request: { id: request?.id },
            seasonNumber: this.seasonNumber,
          },
        });

        if (
          relatedSeasonRequest &&
          (this[request?.is4k ? 'status4k' : 'status'] ===
            MediaStatus.AVAILABLE ||
            this[request?.is4k ? 'status4k' : 'status'] === MediaStatus.DELETED)
        ) {
          relatedSeasonRequest.status = MediaRequestStatus.COMPLETED;
          const seasonNumber = relatedSeasonRequest.seasonNumber;

          const seasonIsDeleted =
            this[request?.is4k ? 'status4k' : 'status'] ===
              MediaStatus.DELETED && this.seasonNumber === seasonNumber;

          if (seasonIsDeleted) {
            relatedSeasonRequest.isMediaDeleted = true;
          }
          seasonRequestRepository.save(relatedSeasonRequest);
        }
      });
    }
  }
}

export default Season;
