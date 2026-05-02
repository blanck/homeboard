import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity, ScrollView, Image} from 'react-native';
import useStore from '../store';
import {formatHeadline, formatPublishedTime} from '../utils/formatting';
import dayjs from 'dayjs';
import {translate} from '../utils/translations';
import {fs, sp} from '../utils/scale';
import WidgetCard from '../components/WidgetCard';

const NewsWidget = () => {
  const articles = useStore((s) => s.articles);
  const showArticle = useStore((s) => s.showArticle);
  const config = useStore((s) => s.config);
  const lang = config.language || 'en';

  const lastUpdated =
    articles && articles.length > 0
      ? dayjs(articles[0].publishedAt).fromNow()
      : '';

  return (
    <WidgetCard variant="light">
      <View style={styles.header}>
        <Text style={styles.title}>{translate('news', lang)}</Text>
        <Text style={styles.updated}>{lastUpdated}</Text>
      </View>
      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {articles
          ? articles.map((article, index) => (
              <TouchableOpacity
                key={index}
                style={styles.row}
                onPress={() => showArticle(article)}>
                <Image
                  source={{
                    uri: article.urlToImage || 'https://via.placeholder.com/80x50',
                  }}
                  style={styles.image}
                />
                <Text style={styles.headline} numberOfLines={2}>
                  {formatHeadline(article.title)}
                </Text>
                <Text style={styles.published}>
                  {formatPublishedTime(article.publishedAt)}
                </Text>
              </TouchableOpacity>
            ))
          : null}
      </ScrollView>
    </WidgetCard>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: fs(12),
    fontWeight: '500',
    color: '#555555',
    textTransform: 'uppercase',
  },
  updated: {
    fontSize: fs(11),
    fontWeight: '400',
    color: '#445566',
    textTransform: 'uppercase',
  },
  list: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 4,
    borderLeftWidth: 5,
    borderLeftColor: 'rgba(255, 255, 255, 0.2)',
    marginVertical: sp(4),
    marginHorizontal: sp(8),
    padding: sp(6),
  },
  image: {
    width: sp(72),
    height: sp(45),
    borderRadius: 4,
    marginRight: sp(8),
  },
  headline: {
    flex: 1,
    fontSize: fs(13),
    fontWeight: 'bold',
    color: '#333333',
    lineHeight: fs(16),
  },
  published: {
    fontSize: fs(11),
    color: '#888888',
    fontWeight: '400',
    marginLeft: 4,
    marginRight: sp(4),
    minWidth: 36,
  },
});

export default NewsWidget;
